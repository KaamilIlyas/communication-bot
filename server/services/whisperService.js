import { spawn } from 'child_process';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { CONFIG } from '../config.js';

class WhisperService {
  constructor() {
    this.worker = null;
    this.readlineInterface = null;
    this.pendingRequests = new Map();
    this.isReady = false;
    this.initPromise = null;
  }

  init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      console.log(`[WhisperService] Spawning persistent STT worker with model: ${CONFIG.whisper.model}...`);
      
      const env = {
        ...process.env,
        WHISPER_MODEL: CONFIG.whisper.model,
        WHISPER_DEVICE: 'cpu',
        WHISPER_COMPUTE_TYPE: 'int8'
      };

      try {
        this.worker = spawn(CONFIG.whisper.pythonPath, [CONFIG.whisper.workerScript], {
          env,
          stdio: ['pipe', 'pipe', 'inherit']
        });
      } catch (err) {
        console.error('[WhisperService] Failed to spawn python STT worker:', err);
        return reject(err);
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
            console.log(`[WhisperService] STT Worker is READY! (Model: ${data.model})`);
            this.isReady = true;
            resolve();
            return;
          }

          if (data.id && this.pendingRequests.has(data.id)) {
            const { resolve: reqResolve, reject: reqReject, timer } = this.pendingRequests.get(data.id);
            clearTimeout(timer);
            this.pendingRequests.delete(data.id);

            if (data.status === 'ok') {
              reqResolve(data);
            } else {
              reqReject(new Error(data.error || 'STT transcription failed'));
            }
          }
        } catch (parseErr) {
          console.error('[WhisperService] Failed to parse worker output:', trimmed, parseErr);
        }
      });

      this.worker.on('error', (err) => {
        console.error('[WhisperService] Worker process error:', err);
        this.isReady = false;
      });

      this.worker.on('exit', (code, signal) => {
        console.warn(`[WhisperService] Worker exited with code ${code}, signal ${signal}`);
        this.isReady = false;
        this.initPromise = null;
        for (const [id, req] of this.pendingRequests.entries()) {
          clearTimeout(req.timer);
          req.reject(new Error('STT worker exited unexpectedly'));
        }
        this.pendingRequests.clear();
      });

      // Timeout for worker initialization (e.g. 90s for first time download if needed)
      setTimeout(() => {
        if (!this.isReady) {
          console.warn('[WhisperService] Initialization timeout. Worker still starting...');
        }
      }, 30000);
    });

    return this.initPromise;
  }

  async transcribeAudioBuffer(buffer, fileExt = 'webm') {
    if (!this.isReady) {
      await this.init();
    }

    const reqId = crypto.randomUUID();
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, `audio_${reqId}.${fileExt}`);

    try {
      await fs.promises.writeFile(tempPath, buffer);

      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (this.pendingRequests.has(reqId)) {
            this.pendingRequests.delete(reqId);
            reject(new Error('STT transcription request timed out after 15s'));
          }
        }, 15000);

        this.pendingRequests.set(reqId, { resolve, reject, timer });

        const payload = JSON.stringify({
          id: reqId,
          audio_path: tempPath,
          language: 'en'
        }) + '\n';

        this.worker.stdin.write(payload);
      });

      return {
        text: result.text || '',
        duration: result.duration || 0,
        language: result.detected_language || 'en'
      };
    } finally {
      // Clean up temp file in background
      fs.promises.unlink(tempPath).catch(() => {});
    }
  }

  getStatus() {
    return {
      ready: this.isReady,
      model: CONFIG.whisper.model
    };
  }
}

export const whisperService = new WhisperService();
