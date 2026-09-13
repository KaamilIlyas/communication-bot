import { CONFIG } from '../config.js';
import { getBestAvailableFreeModel } from './openrouterModelService.js';

export class OpenRouterQuotaError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'OpenRouterQuotaError';
    this.details = details;
  }
}

class OllamaService {
  constructor() {
    this.baseUrl = CONFIG.openrouter && CONFIG.openrouter.apiKey ? CONFIG.openrouter.baseUrl : CONFIG.ollama.url;
    this.model = CONFIG.openrouter && CONFIG.openrouter.apiKey ? CONFIG.openrouter.model : CONFIG.ollama.model;
  }

  async checkHealth() {
    // Determine if we are using OpenRouter for chat
    const usingOpenRouter = CONFIG.openrouter && CONFIG.openrouter.apiKey;
    // For health checks, always query local Ollama instance
    const healthUrl = `${CONFIG.ollama.url}/api/tags`;
    try {
      const res = await fetch(healthUrl);
      if (!res.ok) return { available: false, error: `HTTP ${res.status}` };
      const data = await res.json();
      const models = (data.models || []).map(m => m.name);
      const hasModel = models.some(m => m.startsWith(this.model) || m.includes(this.model));
      return { available: true, models, currentModel: this.model, hasModel };
    } catch (err) {
      return { available: false, error: err.message };
    }
  }

  /**
   * Streams chat completion from OpenRouter or Ollama with sentence-level pipelining.
   * Automatically detects discontinued free models on OpenRouter, queries for active replacements,
   * updates .env, and seamlessly retries.
   * @param {Array<{role: string, content: string}>} history Message history
   * @param {object} options { mode, role, scenario, customPrompt, onChunk, onSentence, signal, provider, apiKey }
   * @returns {Promise<{ fullResponse: string, spokenText: string }>}
   */
  async streamChat(history, options = {}) {
    const {
      mode = 'casual',
      role = 'Full-Stack MERN Developer',
      scenario = '',
      customPrompt = null,
      onChunk = () => {},
      onSentence = () => {},
      signal = null,
      provider = null,
      apiKey = null
    } = options;

    const systemPrompt = customPrompt || CONFIG.getSystemPrompt({ mode, role, scenario });

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history
    ];

    const currentApiKey = apiKey || CONFIG.openrouter?.apiKey;
    const effectiveProvider = provider || (currentApiKey ? 'openrouter' : 'local');

    let response = null;
    const triedModels = new Set();
    const maxOpenRouterRetries = 2;
    let openRouterAttempts = 0;

    // Helper to attempt OpenRouter with automatic model failover
    const tryOpenRouter = async () => {
      if (!this.model || this.model === CONFIG.ollama.model || !this.model.includes('/')) {
        this.model = CONFIG.openrouter.model || 'nex-agi/nex-n2.5-mini:free';
      }
      while (openRouterAttempts <= maxOpenRouterRetries) {
        triedModels.add(this.model);
        console.log(`[LLM] 🌐 Using OpenRouter → model: ${this.model}`);

        const openRouterPayload = {
          model: this.model,
          messages,
          stream: true,
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 300
        };

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentApiKey}`,
          'HTTP-Referer': 'https://english-speaking-bot',
          'X-Title': 'English Speaking Bot'
        };

        let lastErrText = '';
        let lastStatus = 0;

        try {
          const res = await fetch(CONFIG.openrouter.baseUrl || 'https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers,
            body: JSON.stringify(openRouterPayload),
            signal
          });

          if (res.ok) {
            return res;
          }

          lastStatus = res.status;
          lastErrText = await res.text().catch(() => '');
          console.warn(`[LLM] ⚠️ OpenRouter returned ${lastStatus} for model "${this.model}":`, lastErrText);

          const isRateOrDailyLimit = lastStatus === 429 ||
                                     lastStatus === 402 ||
                                     lastErrText.toLowerCase().includes('rate limit') ||
                                     lastErrText.toLowerCase().includes('daily limit') ||
                                     lastErrText.toLowerCase().includes('quota') ||
                                     lastErrText.toLowerCase().includes('too many requests') ||
                                     lastErrText.toLowerCase().includes('credit') ||
                                     lastErrText.toLowerCase().includes('payment required');

          const isModelUnavailable = lastStatus === 404 ||
                                     lastStatus === 400 ||
                                     lastErrText.toLowerCase().includes('unavailable for free') ||
                                     lastErrText.toLowerCase().includes('not found') ||
                                     lastErrText.toLowerCase().includes('no such model') ||
                                     lastErrText.toLowerCase().includes('slug instead');

          if ((isModelUnavailable || isRateOrDailyLimit) && openRouterAttempts < maxOpenRouterRetries) {
            console.log('[LLM] 🔍 Model issue on OpenRouter. Querying for currently active free models...');
            const nextModel = await getBestAvailableFreeModel({
              apiKey: currentApiKey,
              excludedModels: Array.from(triedModels)
            });

            if (nextModel && nextModel !== this.model) {
              console.log(`[LLM] 🔄 Automatically switched to active free model: ${nextModel}`);
              this.model = nextModel;
              CONFIG.openrouter.model = nextModel;
              openRouterAttempts++;
              continue;
            }
          }

          if (isRateOrDailyLimit) {
            throw new OpenRouterQuotaError('OpenRouter rate limit or daily free quota exceeded.', {
              status: lastStatus,
              error: lastErrText
            });
          }
        } catch (fetchErr) {
          if (fetchErr instanceof OpenRouterQuotaError) {
            throw fetchErr;
          }
          console.warn(`[LLM] OpenRouter connection issue:`, fetchErr.message);
        }

        break;
      }
      return null;
    };

    // Helper to attempt local Ollama
    const tryOllama = async () => {
      console.log(`[LLM] 🖥️  Connecting to local Ollama → model: ${CONFIG.ollama.model} (${CONFIG.ollama.url})`);
      this.baseUrl = CONFIG.ollama.url;
      this.model = CONFIG.ollama.model;

      const ollamaPayload = {
        model: this.model,
        messages,
        stream: true,
        options: { temperature: 0.7, top_p: 0.9, num_predict: 120 }
      };

      try {
        const res = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ollamaPayload),
          signal
        });
        if (res.ok) return res;
      } catch (localErr) {
        console.warn(`[LLM] Local Ollama unavailable:`, localErr.message);
      }
      return null;
    };

    // Dual-direction fallback:
    // If effectiveProvider is openrouter, try OpenRouter first, then Ollama.
    // If effectiveProvider is local, try Ollama first; if offline, fallback to OpenRouter.
    if (effectiveProvider === 'openrouter' && currentApiKey) {
      response = await tryOpenRouter();
      if (!response && !signal?.aborted) {
        console.log('[LLM] 🔄 OpenRouter unavailable. Falling back to local Ollama...');
        response = await tryOllama();
      }
    } else {
      response = await tryOllama();
      if (!response && currentApiKey && !signal?.aborted) {
        console.log('[LLM] 🔄 Local Ollama offline. Falling back to OpenRouter...');
        response = await tryOpenRouter();
      }
    }

    if (!response || !response.ok) {
      throw new Error('Unable to connect to OpenRouter or local Ollama. Please verify your OpenRouter API key or run Ollama locally.');
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => response.status);
      throw new Error(`LLM request failed (${response.status}): ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullResponse = '';
    let sentenceBuffer = '';
    let sentenceIndex = 0;
    let isThinking = false;
    let thinkingBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((l) => l.trim().length > 0);

      for (const line of lines) {
        try {
          // Handle OpenAI-compatible SSE format (OpenRouter) and raw Ollama JSON
          let rawLine = line;
          if (rawLine.startsWith('data: ')) {
            rawLine = rawLine.slice(6).trim();
          }
          if (rawLine === '[DONE]') continue;

          const json = JSON.parse(rawLine);

          // OpenAI/OpenRouter format: choices[0].delta.content
          // Ollama format: message.content
          let token = json.choices?.[0]?.delta?.content || json.message?.content || '';

          if (!token) continue;

          // Detect & filter out Chain-of-Thought / "thinking process" blocks
          if (!isThinking) {
            const combinedPreview = (thinkingBuffer + token).toLowerCase();
            if (token.includes('<think>') || combinedPreview.includes("here's a thinking process") || combinedPreview.includes("thinking process:")) {
              isThinking = true;
            }
          }

          if (isThinking) {
            thinkingBuffer += token;
            if (thinkingBuffer.includes('</think>')) {
              isThinking = false;
              token = thinkingBuffer.split('</think>')[1] || '';
              thinkingBuffer = '';
              if (!token) continue;
            } else if (/here'?s a thinking process/i.test(thinkingBuffer) && (thinkingBuffer.includes('\n\n') || thinkingBuffer.includes('\r\n\r\n'))) {
              const parts = thinkingBuffer.split(/\n\s*\n/);
              const lastPart = parts[parts.length - 1].trim();
              if (lastPart && !lastPart.match(/^\d+\./) && !lastPart.startsWith('-') && !lastPart.toLowerCase().includes('analyze') && !lastPart.toLowerCase().includes('identify')) {
                isThinking = false;
                token = lastPart;
                thinkingBuffer = '';
              } else {
                continue;
              }
            } else {
              // Suppress thinking tokens from being spoken or emitted
              continue;
            }
          }

          fullResponse += token;
          sentenceBuffer += token;
          onChunk(token);

          // Natural sentence boundary detection — only cut at sentence-ending punctuation
          // to avoid mid-sentence audio gaps from comma/colon splits
          const wordCount = sentenceBuffer.trim().split(/\s+/).filter(Boolean).length;
          const sentenceEnd = /[.!?](\s|$)/.test(sentenceBuffer);
          const newlineBreak = sentenceBuffer.includes('\n');

          let shouldCut = false;
          let cutIdx = -1;

          if (sentenceEnd) {
            // Find the last sentence-ending punctuation followed by space/end
            const match = sentenceBuffer.match(/[.!?](?=\s|$)/);
            if (match) {
              cutIdx = match.index + 1;
              shouldCut = true;
            }
          } else if (newlineBreak) {
            cutIdx = sentenceBuffer.lastIndexOf('\n') + 1;
            shouldCut = cutIdx > 1;
          } else if (sentenceIndex === 0 && wordCount >= 8) {
            // First chunk: emit fast after 8 words if no punctuation yet
            cutIdx = sentenceBuffer.length;
            shouldCut = true;
          } else if (sentenceIndex > 0 && wordCount >= 15) {
            // Safety valve: avoid indefinitely long buffers
            cutIdx = sentenceBuffer.length;
            shouldCut = true;
          }

          if (shouldCut && cutIdx > 0) {
            const completeSentence = sentenceBuffer.substring(0, cutIdx).trim();
            sentenceBuffer = sentenceBuffer.substring(cutIdx);

            if (completeSentence) {
              onSentence(completeSentence, sentenceIndex++);
            }
          }
        } catch (e) {
          // Ignore JSON parse chunk errors
        }
      }
    }

    // Flush any remaining buffered text as final phrase
    const remaining = sentenceBuffer.trim();
    if (remaining) {
      onSentence(remaining, sentenceIndex++);
    }

    // Final safety clean for spoken text: remove any residual thinking artifacts
    let spokenText = fullResponse.trim();
    spokenText = spokenText
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<think>[\s\S]*$/gi, '')
      .replace(/here'?s a thinking process:?[\s\S]*?(?=\n\n[A-Z"“]|\n[A-Z"“]|$)/gi, '')
      .trim();

    return {
      fullResponse: spokenText,
      spokenText
    };
  }
}

export const ollamaService = new OllamaService();
