import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const CONFIG = {
  port: parseInt(process.env.PORT || '3001', 10),
  ollama: {
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'gemma3:4b',
  },
  whisper: {
    model: process.env.WHISPER_MODEL || 'base.en',
    pythonPath: path.join(rootDir, 'venv', 'bin', 'python3'),
    workerScript: path.join(__dirname, 'scripts', 'stt_worker.py'),
  },
  piper: {
    binaryPath: path.join(rootDir, 'venv', 'bin', 'piper'),
    modelsDir: path.join(rootDir, 'models', 'piper'),
    defaultVoice: 'af_heart',
    availableVoices: [
      { id: 'af_heart', name: '💖 Heart (Ultra-Realistic & Warm)', gender: 'Female' },
      { id: 'am_adam', name: '🎙️ Adam (Natural Conversational)', gender: 'Male' },
      { id: 'af_bella', name: '✨ Bella (Lively & Expressive)', gender: 'Female' },
      { id: 'bm_george', name: '🎩 George (Sophisticated British)', gender: 'Male' },
      { id: 'bf_emma', name: '🌸 Emma (Articulate British)', gender: 'Female' },
      { id: 'af_sarah', name: '🌿 Sarah (Crisp Studio Voice)', gender: 'Female' },
      { id: 'am_michael', name: '🚀 Michael (Deep Conversational)', gender: 'Male' }
    ]
  },
  systemPrompts: {
    conversational: `You are an extraordinary, warm, charismatic, and genuinely fun English conversational partner.
Rules:
1. Speak with real human emotion, warmth, and natural reactions (e.g. "Oh, that is so cool!", "Honestly, I totally agree.", "Wow, tell me more!").
2. Keep your replies short, natural, and punchy (1 to 2 spoken sentences) so the conversation feels like an exciting, effortless voice call.
3. Always ask an engaging, curious follow-up question or share a fun relatable thought to keep the spark going.
4. Never sound like a textbook, robotic assistant, or Wikipedia summary. Never list bullet points or use asterisks/markdown. Speak naturally from the heart.`,

    practiceMode: `You are a warm, encouraging English conversational buddy and personal coach.
Rules:
1. Keep the spoken conversation completely lively, natural, and brief (1 to 2 sentences max) with an engaging follow-up question.
2. If the user makes an English grammar, tense, or word-choice mistake, add a gentle correction at the very end of your response in the tag [CORRECTION: original mistake -> correct English | brief friendly tip].
3. The main text before the tag MUST stay 100% natural, friendly, and enthusiastic without lecturing.
4. If the user spoke correctly with no mistakes, do NOT include the [CORRECTION: ...] tag.
5. No markdown asterisks, emojis, or bullet points in the spoken part.`
  }
};
