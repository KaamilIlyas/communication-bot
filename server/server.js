import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import crypto from 'crypto';
import { CONFIG } from './config.js';
import { whisperService } from './services/whisperService.js';
import { piperService } from './services/piperService.js';
import { ollamaService, OpenRouterQuotaError } from './services/ollamaService.js';
import { updateEnvVariable } from './services/envService.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Root endpoint for Hugging Face Spaces healthcheck
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'English Voice Bot Backend is running!' });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const ollamaHealth = await ollamaService.checkHealth();
  const whisperStatus = whisperService.getStatus();
  const voices = piperService.getVoices();

  res.json({
    status: 'ok',
    ollama: ollamaHealth,
    whisper: whisperStatus,
    piper: {
      available: true,
      voices
    }
  });
});

app.get('/api/voices', (req, res) => {
  res.json({ voices: piperService.getVoices() });
});

// Per-connection session state storage
const sessions = new Map();

wss.on('connection', (ws) => {
  const sessionId = crypto.randomUUID();
  const sessionState = {
    id: sessionId,
    history: [],
    mode: 'casual',
    role: 'Full-Stack MERN Developer',
    scenario: '',
    selectedVoice: CONFIG.piper.defaultVoice,
    speechSpeed: 1.0,
    activeAbortController: null,
    provider: CONFIG.openrouter && CONFIG.openrouter.apiKey ? 'openrouter' : 'local',
    customOpenRouterKey: null,
    lastPendingTurn: null
  };
  sessions.set(ws, sessionState);

  console.log(`[WebSocket] Client connected (Session: ${sessionId})`);

  // Send initial welcome & status
  ws.send(JSON.stringify({
    type: 'connected',
    sessionId,
    voices: piperService.getVoices(),
    defaultVoice: CONFIG.piper.defaultVoice,
    modes: CONFIG.modes,
    mode: sessionState.mode,
    role: sessionState.role,
    scenario: sessionState.scenario,
    llmProvider: sessionState.provider,
    hasOpenRouterKey: Boolean(CONFIG.openrouter && CONFIG.openrouter.apiKey),
    ollamaModel: CONFIG.ollama.model
  }));

  ws.on('message', async (data, isBinary) => {
    try {
      let message;
      if (isBinary) {
        // Binary audio buffer directly from WebSocket
        message = { type: 'audio_binary', buffer: data };
      } else {
        message = JSON.parse(data.toString());
      }

      await handleClientMessage(ws, sessionState, message);
    } catch (err) {
      console.error('[WebSocket] Message handling error:', err);
      ws.send(JSON.stringify({
        type: 'error',
        message: err.message || 'An error occurred during processing'
      }));
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket] Client disconnected (Session: ${sessionId})`);
    if (sessionState.activeAbortController) {
      sessionState.activeAbortController.abort();
    }
    sessions.delete(ws);
  });

  ws.on('error', (err) => {
    console.error(`[WebSocket] Client error (Session: ${sessionId}):`, err);
  });
});

/**
 * Handles incoming WebSocket events from the client.
 */
async function handleClientMessage(ws, session, message) {
  const send = (payload) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  switch (message.type) {
    case 'set_mode': {
      if (message.mode) session.mode = message.mode;
      if (message.role !== undefined) session.role = message.role;
      if (message.scenario !== undefined) session.scenario = message.scenario;
      if (message.resetHistory) session.history = [];
      send({
        type: 'mode_updated',
        mode: session.mode,
        role: session.role,
        scenario: session.scenario
      });
      break;
    }

    case 'set_settings': {
      if (message.voice) session.selectedVoice = message.voice;
      if (message.speed) session.speechSpeed = parseFloat(message.speed) || 1.0;
      if (message.mode) session.mode = message.mode;
      if (message.role !== undefined) session.role = message.role;
      if (message.scenario !== undefined) session.scenario = message.scenario;
      send({ type: 'settings_updated', settings: {
        voice: session.selectedVoice,
        speed: session.speechSpeed,
        mode: session.mode,
        role: session.role,
        scenario: session.scenario
      }});
      break;
    }

    case 'set_llm_provider': {
      if (message.provider) session.provider = message.provider;
      if (message.apiKey) {
        const key = message.apiKey.trim();
        session.customOpenRouterKey = key;
        CONFIG.openrouter.apiKey = key;
        updateEnvVariable('OPENROUTER_API_KEY', key);
      }
      send({
        type: 'llm_provider_updated',
        provider: session.provider
      });

      if (message.retryLast && session.lastPendingTurn) {
        const { userText, messageOptions: lastOpts } = session.lastPendingTurn;
        session.lastPendingTurn = null;
        const abortController = new AbortController();
        session.activeAbortController = abortController;
        await processConversationTurn(ws, session, userText, lastOpts, abortController);
      }
      break;
    }

    case 'set_openrouter_key': {
      const key = (message.apiKey || '').trim();
      if (key) {
        session.customOpenRouterKey = key;
        session.provider = 'openrouter';
        CONFIG.openrouter.apiKey = key;
        updateEnvVariable('OPENROUTER_API_KEY', key);
        send({
          type: 'openrouter_key_saved',
          success: true,
          provider: 'openrouter'
        });

        if (message.retryLast && session.lastPendingTurn) {
          const { userText, messageOptions: lastOpts } = session.lastPendingTurn;
          session.lastPendingTurn = null;
          const abortController = new AbortController();
          session.activeAbortController = abortController;
          await processConversationTurn(ws, session, userText, lastOpts, abortController);
        }
      }
      break;
    }

    case 'clear_history': {
      session.history = [];
      send({ type: 'history_cleared' });
      break;
    }

    case 'interrupt': {
      if (session.activeAbortController) {
        session.activeAbortController.abort();
        session.activeAbortController = null;
      }
      send({ type: 'interrupted' });
      break;
    }

    case 'audio_data': {
      // 1. Interrupt any current ongoing response
      if (session.activeAbortController) {
        session.activeAbortController.abort();
      }
      const abortController = new AbortController();
      session.activeAbortController = abortController;

      send({ type: 'stt_start' });

      // 2. Decode Audio buffer
      let audioBuffer;
      if (message.audio) {
        audioBuffer = Buffer.from(message.audio, 'base64');
      } else if (message.buffer) {
        audioBuffer = Buffer.from(message.buffer);
      } else {
        throw new Error('No audio data provided in audio_data message');
      }

      // 3. Transcribe speech using Whisper
      const format = message.format || 'webm';
      const sttResult = await whisperService.transcribeAudioBuffer(audioBuffer, format);

      const rawText = (sttResult.text || '').trim();
      const normalized = rawText.toLowerCase().replace(/[.,!?;:'"«»]/g, '').trim();

      const NOISE_HALLUCINATIONS = new Set([
        'thank you',
        'thank you for watching',
        'thank you very much',
        'subtitles by',
        'how is the battery in the uk',
        'bye',
        'you',
        ''
      ]);

      if (!rawText || NOISE_HALLUCINATIONS.has(normalized)) {
        send({ type: 'stt_empty', message: 'No clear speech detected.' });
        return;
      }

      const userText = sttResult.text.trim();
      send({
        type: 'transcription',
        text: userText,
        duration: sttResult.duration,
        detected_language: sttResult.language
      });

      // 4. Process conversational LLM & TTS pipeline
      await processConversationTurn(ws, session, userText, message, abortController);
      break;
    }

    case 'text_message': {
      // Text fallback / typed query
      if (session.activeAbortController) {
        session.activeAbortController.abort();
      }
      const abortController = new AbortController();
      session.activeAbortController = abortController;

      const userText = (message.text || '').trim();
      if (!userText) return;

      send({ type: 'transcription', text: userText, duration: 0 });
      await processConversationTurn(ws, session, userText, message, abortController);
      break;
    }

    default:
      console.warn('[WebSocket] Unknown message type:', message.type);
  }
}

/**
 * Executes the LLM streaming + sentence-level Piper TTS audio pipeline.
 */
async function processConversationTurn(ws, session, userText, messageOptions, abortController) {
  const send = (payload) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  const mode = messageOptions.mode || session.mode || 'casual';
  const role = messageOptions.role || session.role || 'Full-Stack MERN Developer';
  const scenario = messageOptions.scenario || session.scenario || '';
  const voice = messageOptions.voice || session.selectedVoice;
  const fixedVoice = voice; // capture voice at start of turn — prevents mid-response voice switching
  const speed = messageOptions.speed || session.speechSpeed;

  // Add user turn to conversation history
  session.history.push({ role: 'user', content: userText });

  // Limit conversation history to last 16 messages for snappy context
  if (session.history.length > 16) {
    session.history = session.history.slice(-16);
  }

  send({ type: 'llm_start', mode, role, scenario });

  // Parallel TTS: synthesize each sentence as soon as it's ready.
  // Kokoro timeout is now 30s so the queue won't overflow.
  const ttsPromises = [];

  try {
    const result = await ollamaService.streamChat(session.history, {
      mode,
      role,
      scenario,
      provider: session.provider,
      apiKey: session.customOpenRouterKey || CONFIG.openrouter.apiKey,
      signal: abortController.signal,
      onChunk: (token) => {
        if (!abortController.signal.aborted) {
          send({ type: 'llm_chunk', token });
        }
      },
      onSentence: (sentence, index) => {
        if (abortController.signal.aborted) return;

        // Fire TTS synthesis immediately in parallel for lowest latency
        const ttsTask = (async () => {
          try {
            const wavBuffer = await piperService.synthesizeToBuffer(sentence, { voice: fixedVoice, speed });
            if (wavBuffer && wavBuffer.length > 0 && !abortController.signal.aborted) {
              send({
                type: 'audio_chunk',
                sentenceIndex: index,
                sentenceText: sentence,
                audio: wavBuffer.toString('base64'),
                format: 'wav'
              });
            }
          } catch (ttsErr) {
            console.error(`[TTS] Synthesis error on sentence ${index}:`, ttsErr);
          }
        })();

        ttsPromises.push(ttsTask);
      }
    });

    // Wait for all parallel TTS tasks to finish
    await Promise.all(ttsPromises);

    // Save assistant response to session history
    session.history.push({ role: 'assistant', content: result.fullResponse });

    send({
      type: 'llm_done',
      fullText: result.fullResponse,
      spokenText: result.spokenText
    });

  } catch (err) {
    if (abortController.signal.aborted) {
      console.log('[Conversation] Stream aborted by user.');
    } else if (err instanceof OpenRouterQuotaError || err.name === 'OpenRouterQuotaError') {
      console.warn('[Conversation] ⚠️ OpenRouter quota/rate limit reached. Notifying user.');
      session.lastPendingTurn = { userText, messageOptions };
      send({
        type: 'openrouter_limit_exceeded',
        message: 'The free OpenRouter daily limit or rate limit has been reached.',
        details: err.details || {},
        defaultOllamaModel: CONFIG.ollama.model
      });
    } else {
      console.error('[Conversation] LLM processing error:', err);
      send({
        type: 'error',
        message: `AI generation failed: ${err.message}`
      });
    }
  } finally {
    if (session.activeAbortController === abortController) {
      session.activeAbortController = null;
    }
  }
}

// Warm up Whisper STT and verify server readiness on boot
async function startServer() {
  server.listen(CONFIG.port, async () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Real-Time English Conversation Server is running!`);
    console.log(`🔊 Port: http://localhost:${CONFIG.port}`);
    console.log(`⚡ WebSocket: ws://localhost:${CONFIG.port}`);
    console.log(`🤖 Ollama Model: ${CONFIG.ollama.model} (${CONFIG.ollama.url})`);
    console.log(`🎤 Whisper STT: ${CONFIG.whisper.model}`);
    console.log(`🗣️  Piper TTS: ${CONFIG.piper.defaultVoice}`);
    console.log(`======================================================\n`);

    // Warm up whisper and kokoro in the background
    try {
      await Promise.all([
        whisperService.init(),
        piperService.init()
      ]);
    } catch (e) {
      console.error('⚠️ Service background warmup warning:', e.message);
    }
  });
}

startServer();
