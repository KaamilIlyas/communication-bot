import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import crypto from 'crypto';
import { CONFIG } from './config.js';
import { whisperService } from './services/whisperService.js';
import { piperService } from './services/piperService.js';
import { ollamaService } from './services/ollamaService.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
    isPracticeMode: false,
    selectedVoice: CONFIG.piper.defaultVoice,
    speechSpeed: 1.0,
    activeAbortController: null
  };
  sessions.set(ws, sessionState);

  console.log(`[WebSocket] Client connected (Session: ${sessionId})`);

  // Send initial welcome & status
  ws.send(JSON.stringify({
    type: 'connected',
    sessionId,
    voices: piperService.getVoices(),
    defaultVoice: CONFIG.piper.defaultVoice
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
    case 'set_settings': {
      if (message.voice) session.selectedVoice = message.voice;
      if (message.speed) session.speechSpeed = parseFloat(message.speed) || 1.0;
      if (typeof message.practiceMode === 'boolean') session.isPracticeMode = message.practiceMode;
      send({ type: 'settings_updated', settings: {
        voice: session.selectedVoice,
        speed: session.speechSpeed,
        practiceMode: session.isPracticeMode
      }});
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

      if (!sttResult.text || !sttResult.text.trim()) {
        send({ type: 'stt_empty', message: 'No clear speech detected. Please speak into the mic.' });
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

  const isPracticeMode = messageOptions.isPracticeMode ?? session.isPracticeMode;
  const voice = messageOptions.voice || session.selectedVoice;
  const speed = messageOptions.speed || session.speechSpeed;

  // Add user turn to conversation history
  session.history.push({ role: 'user', content: userText });

  // Limit conversation history to last 16 messages for snappy context
  if (session.history.length > 16) {
    session.history = session.history.slice(-16);
  }

  send({ type: 'llm_start', isPracticeMode });

  const ttsPromises = [];

  try {
    const result = await ollamaService.streamChat(session.history, {
      isPracticeMode,
      signal: abortController.signal,
      onChunk: (token) => {
        if (!abortController.signal.aborted) {
          send({ type: 'llm_chunk', token });
        }
      },
      onSentence: (sentence, index) => {
        if (abortController.signal.aborted) return;
        
        // As soon as a sentence is formed, kick off Piper TTS synthesis in parallel!
        const ttsTask = (async () => {
          try {
            const wavBuffer = await piperService.synthesizeToBuffer(sentence, { voice, speed });
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
            console.error(`[Piper TTS] Synthesis error on sentence ${index}:`, ttsErr);
          }
        })();

        ttsPromises.push(ttsTask);
      }
    });

    // Wait for any remaining TTS chunks to complete
    await Promise.all(ttsPromises);

    // Save assistant response to session history
    session.history.push({ role: 'assistant', content: result.fullResponse });

    send({
      type: 'llm_done',
      fullText: result.fullResponse,
      spokenText: result.spokenText,
      correction: result.correction
    });

  } catch (err) {
    if (abortController.signal.aborted) {
      console.log('[Conversation] Stream aborted by user.');
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
