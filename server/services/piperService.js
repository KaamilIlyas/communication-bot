import { spawn } from 'child_process';
import readline from 'readline';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { CONFIG } from '../config.js';

class TTSService {
  constructor() {
    this.worker = null;
    this.readlineInterface = null;
    this.pendingRequests = new Map();
    this.isReady = false;
    this.initPromise = null;
    this.modelsDir = CONFIG.piper.modelsDir;
  }

  init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve) => {
      console.log('[TTSService] Spawning Kokoro Neural Voice Daemon...');
      const scriptPath = path.join(path.dirname(CONFIG.whisper.workerScript), 'tts_worker.py');

      try {
        this.worker = spawn(CONFIG.whisper.pythonPath, [scriptPath], {
          stdio: ['pipe', 'pipe', 'inherit']
        });
      } catch (err) {
        console.error('[TTSService] Failed to spawn Kokoro worker:', err);
        return resolve(); // fallback to piper
      }

      this.readlineInterface = readline.createInterface({
        input: this.worker.stdout,
        terminal: false
      });

      this.readlineInterface.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        try {
          const data = JSON.parse(trimmed);
          if (data.status === 'ready') {
            console.log('[TTSService] Kokoro Neural Voice Worker is READY!');
            this.isReady = true;
            resolve();
            return;
          }

          if (data.id && this.pendingRequests.has(data.id)) {
            const { resolve: reqResolve, reject: reqReject, timer } = this.pendingRequests.get(data.id);
            clearTimeout(timer);
            this.pendingRequests.delete(data.id);

            if (data.status === 'ok') {
              const buffer = Buffer.from(data.audio, 'base64');
              reqResolve(buffer);
            } else {
              reqReject(new Error(data.error || 'TTS synthesis failed'));
            }
          }
        } catch (e) {
          console.error('[TTSService] Failed to parse worker line:', trimmed, e);
        }
      });

      this.worker.on('exit', () => {
        this.isReady = false;
        this.initPromise = null;
      });

      setTimeout(() => {
        if (!this.isReady) resolve();
      }, 10000);
    });

    return this.initPromise;
  }

  cleanTextForSpeech(text) {
    if (!text) return '';
    return text
      .replace(/\[CORRECTION:.*?\]/gis, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Synthesizes text into a high-fidelity WAV audio buffer.
   */
  async synthesizeToBuffer(text, options = {}) {
    const cleanedText = this.cleanTextForSpeech(text);
    if (!cleanedText) return Buffer.alloc(0);

    const voice = options.voice || CONFIG.piper.defaultVoice;
    const speed = options.speed ? Number(options.speed) : 1.0;

    // If voice is a Kokoro voice (starts with af_, am_, bf_, bm_) and worker is ready:
    if (this.isKokoroVoice(voice)) {
      if (!this.isReady) {
        await this.init();
      }

      if (this.isReady && this.worker) {
        const reqId = crypto.randomUUID();
        const ttsStart = Date.now();
        try {
          const result = await new Promise((resolve, reject) => {
            // Kokoro is single-threaded; allow 30s so queued sentences don't time out
            const timer = setTimeout(() => {
              this.pendingRequests.delete(reqId);
              reject(new Error('Kokoro TTS synthesis timed out'));
            }, 30000);

            this.pendingRequests.set(reqId, { resolve, reject, timer });
            const payload = JSON.stringify({
              id: reqId,
              text: cleanedText,
              voice,
              speed
            }) + '\n';
            this.worker.stdin.write(payload);
          });
          const elapsed = ((Date.now() - ttsStart) / 1000).toFixed(2);
          console.log(`[TTS] 🎙️  Kokoro synthesized "${cleanedText.slice(0, 40)}…" in ${elapsed}s`);
          return result;
        } catch (e) {
          console.warn(`[TTS] ⚠️  Kokoro failed (${e.message}), switching to Piper`);
        }
      }
    }

    // Piper fallback synthesis (only Piper voices, or when Kokoro is unavailable)
    console.log(`[TTS] 🔊 Using Piper for: "${cleanedText.slice(0, 40)}…"`);
    return this.synthesizeWithPiper(cleanedText, voice, speed);
  }

  isKokoroVoice(voice) {
    return voice.startsWith('af_') || voice.startsWith('am_') || voice.startsWith('bf_') || voice.startsWith('bm_');
  }

  async synthesizeWithPiper(cleanedText, voice, speed) {
    const modelFileName = voice.includes('en_') ? `${voice}.onnx` : `${CONFIG.piper.availableVoices[0].id}.onnx`;
    let modelPath = path.join(this.modelsDir, modelFileName);
    if (!fs.existsSync(modelPath)) {
      modelPath = path.join(this.modelsDir, 'en_US-lessac-medium.onnx');
    }

    const lengthScale = (1.0 / Math.max(0.5, Math.min(2.0, speed))).toFixed(3);

    return new Promise((resolve, reject) => {
      const args = [
        '-m', 'piper',
        '--model', modelPath,
        '--length-scale', lengthScale,
        '--noise-scale', '0.667',
        '--noise-w-scale', '0.8',
        '--output-file', '-'
      ];

      const piperProcess = spawn(CONFIG.whisper.pythonPath, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const audioChunks = [];
      let stderrOutput = '';

      piperProcess.stdout.on('data', chunk => audioChunks.push(chunk));
      piperProcess.stderr.on('data', chunk => { stderrOutput += chunk.toString(); });
      piperProcess.on('error', err => reject(err));
      piperProcess.on('close', code => {
        if (code === 0) {
          resolve(Buffer.concat(audioChunks));
        } else {
          reject(new Error(`Piper TTS failed with exit code ${code}: ${stderrOutput}`));
        }
      });

      piperProcess.stdin.write(cleanedText);
      piperProcess.stdin.end();
    });
  }

  getVoices() {
    return CONFIG.piper.availableVoices;
  }
}

export const ttsService = new TTSService();
export const piperService = ttsService; // backward compatibility
