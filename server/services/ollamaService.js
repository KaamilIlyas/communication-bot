import { CONFIG } from '../config.js';

class OllamaService {
  constructor() {
    this.baseUrl = CONFIG.ollama.url;
    this.model = CONFIG.ollama.model;
  }

  async checkHealth() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
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
   * Streams chat completion from Ollama with sentence-level pipelining.
   * @param {Array<{role: string, content: string}>} history Message history
   * @param {object} options { isPracticeMode, customPrompt, onChunk, onSentence, signal }
   * @returns {Promise<{ fullResponse: string, spokenText: string, correction: object|null }>}
   */
  async streamChat(history, options = {}) {
    const {
      isPracticeMode = false,
      customPrompt = null,
      onChunk = () => {},
      onSentence = () => {},
      signal = null
    } = options;

    const systemPrompt = customPrompt || (isPracticeMode ? CONFIG.systemPrompts.practiceMode : CONFIG.systemPrompts.conversational);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history
    ];

    const payload = {
      model: this.model,
      messages: messages,
      stream: true,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 120 // Short, fast conversational turns
      }
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama request failed (${response.status}): ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let fullResponse = '';
    let sentenceBuffer = '';
    let sentenceIndex = 0;

    // Natural conversational speech boundary regex:
    // 1. Terminal punctuation (. ! ? \n)
    // 2. Clause punctuation (, ; : -) if buffer has at least 5 words
    const terminalPunctRegex = /([.!?]+|\n+)(?:\s+|$)/;
    const clausePunctRegex = /([,;:—\-]+)(?:\s+|$)/;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkStr = decoder.decode(value, { stream: true });
      const lines = chunkStr.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          const token = json.message?.content || '';
          if (!token) continue;

          fullResponse += token;
          sentenceBuffer += token;
          onChunk(token);

          // If the model started writing a correction tag, don't send it to TTS
          if (sentenceBuffer.includes('[CORRECTION:')) {
            const corrStart = sentenceBuffer.indexOf('[CORRECTION:');
            const preCorrText = sentenceBuffer.substring(0, corrStart).trim();
            if (preCorrText) {
              onSentence(preCorrText, sentenceIndex++);
            }
            sentenceBuffer = '';
            continue;
          }

          const words = sentenceBuffer.trim().split(/\s+/).filter(Boolean);
          let shouldCut = false;
          let cutIdx = -1;

          // 1. Kickstart first chunk with low latency (4+ words on any punct or 7+ words)
          if (sentenceIndex === 0) {
            const firstPunctMatch = /([.!?,\n;:]+)(?:\s+|$)/.exec(sentenceBuffer);
            if (firstPunctMatch && words.length >= 4) {
              shouldCut = true;
              cutIdx = firstPunctMatch.index + firstPunctMatch[0].length;
            } else if (words.length >= 7) {
              const spaceMatches = [...sentenceBuffer.matchAll(/\s+/g)];
              if (spaceMatches.length >= 5) {
                const spaceMatch = spaceMatches[4];
                shouldCut = true;
                cutIdx = spaceMatch.index + spaceMatch[0].length;
              }
            }
          } else {
            // 2. Subsequent chunks:
            const termMatch = /([.!?]+|\n+)(?:\s+|$)/.exec(sentenceBuffer);
            if (termMatch && words.length >= 3) {
              shouldCut = true;
              cutIdx = termMatch.index + termMatch[0].length;
            } else {
              const clauseMatch = /([,;:—\-]+)(?:\s+|$)/.exec(sentenceBuffer);
              if (clauseMatch && words.length >= 5) {
                shouldCut = true;
                cutIdx = clauseMatch.index + clauseMatch[0].length;
              } else if (words.length >= 10) {
                const spaceMatches = [...sentenceBuffer.matchAll(/\s+/g)];
                if (spaceMatches.length >= 7) {
                  const spaceMatch = spaceMatches[6];
                  shouldCut = true;
                  cutIdx = spaceMatch.index + spaceMatch[0].length;
                }
              }
            }
          }

          if (shouldCut && cutIdx > 0) {
            const completeSentence = sentenceBuffer.substring(0, cutIdx).trim();
            sentenceBuffer = sentenceBuffer.substring(cutIdx);

            if (completeSentence && !completeSentence.startsWith('[CORRECTION:')) {
              onSentence(completeSentence, sentenceIndex++);
            }
          }
        } catch (e) {
          // Ignore JSON parse chunk errors
        }
      }
    }

    // Flush any remaining buffered text as final phrase
    const remaining = sentenceBuffer.replace(/\[CORRECTION:.*?\]/gis, '').trim();
    if (remaining) {
      onSentence(remaining, sentenceIndex++);
    }

    // Robust parsing for English practice correction tags
    let correction = null;
    const regexList = [
      /\[CORRECTION:\s*([^->\n|]+)\s*->\s*([^|\n\]]+)\s*\|\s*([^\]]+)\]/i,
      /\[CORRECTION:\s*original:\s*([^,\n]+),\s*corrected:\s*([^,\n]+),\s*explanation:\s*([^\]]+)\]/i,
      /\[CORRECTION:\s*["']?([^"'->\n]+)["']?\s*->\s*["']?([^"'|\n]+)["']?\s*(?:\||:|-)\s*([^\]]+)\]/i
    ];

    for (const re of regexList) {
      const match = fullResponse.match(re);
      if (match) {
        correction = {
          original: match[1].replace(/["']/g, '').trim(),
          corrected: match[2].replace(/["']/g, '').trim(),
          explanation: match[3].replace(/["']/g, '').trim()
        };
        break;
      }
    }

    const spokenText = fullResponse.replace(/\[CORRECTION:.*?\]/gis, '').trim();

    return {
      fullResponse,
      spokenText,
      correction
    };
  }
}

export const ollamaService = new OllamaService();
