# 🎙️ Local Real-Time Spoken English Voice AI

A fast, real-time voice-to-voice conversational AI partner and English speaking coach. Runs **100% locally and privately** on your machine with zero cloud API costs.

---

## ⚡ Tech Stack & Architecture

| Layer | Technology | Role & Details |
|---|---|---|
| **Frontend** | **React 18 + Vite** | High-performance reactive UI with custom Web Audio visualizers and glassmorphic styling. |
| **Audio Engine** | **Web Audio API** | Real-time PCM capture, downsampling to 16kHz WAV, and gapless parallel pre-decoding. |
| **Networking** | **WebSockets (`ws`)** | Full-duplex, low-latency streaming for binary audio chunks, live text, and control events. |
| **Backend** | **Node.js (ES Modules)** | Express server orchestrating STT, LLM streaming, and sentence-level TTS pipelining. |
| **LLM** | **Ollama (`gemma3:4b`)** | Local LLM tuned for short, natural, human-like dialogue and optional grammar feedback. |
| **STT** | **Faster-Whisper (`base.en`)** | Persistent Python IPC worker holding model in RAM for ~0.8s speech-to-text. |
| **TTS** | **Kokoro-v1.0 & Piper** | Multi-threaded ONNX neural voices for natural, human-like speech synthesis. |

---

## 🔄 Real-Time Pipeline Workflow

```
[User Microphone]
       │  (Web Audio API: 16kHz 16-bit Mono WAV)
       ▼
[React Frontend]
       │  (WebSocket: audio_data)
       ▼
[Node.js Server]
       │
       ├──▶ [Faster-Whisper STT Daemon] ──▶ Transcribed Text (sub-second)
       │                                           │
       ├──▶ [Ollama gemma3:4b LLM] ◀───────────────┘
       │         │
       │         └──▶ Sentence & Phrase Streamer
       │                     │
       │                     ▼
       └──▶ [Kokoro Neural TTS Daemon] (Multi-threaded ONNX)
                     │
                     ▼  (WebSocket: audio_chunk)
[React Gapless Audio Player] ◀──▶ Speech-Synchronized Live Text Display
```

---

## 🚀 Key Features

- **⚡ Sub-Second Voice Response**: First phrase begins synthesizing in ~100ms, starting playback in ~0.5s.
- **✨ Speech-Synchronized Text (Lockstep Display)**: Text appears on screen in real-time as words are spoken, keeping visuals and audio aligned.
- **🗣️ State-of-the-Art Neural Voices**: Ultra-realistic Kokoro voices (Heart, Adam, Bella, George, Emma, Sarah, Michael).
- **🎓 English Coaching Mode**: Detects grammar, tense, and vocabulary mistakes in real time, delivering gentle correction cards without interrupting conversation flow.
- **📻 Hands-Free Auto-VAD**: Automatically detects when you finish speaking, sends audio, and re-arms the microphone when the AI finishes talking.
- **🛑 Instant Barge-In / Interrupt**: Stop AI speech and token generation instantly at any time.

---

## 🛠️ Quick Start

### 1. Prerequisites
- **Ollama**: Install from [ollama.com](https://ollama.com) and pull the model:
  ```bash
  ollama pull gemma3:4b
  ```
- **Node.js**: v18+ 
- **Python**: 3.11+ (Python 3.13 recommended)

### 2. Install & Download Models
Run the automated setup script from the project root:
```bash
./setup.sh
```
This script configures the Python virtual environment (`./venv`), installs all dependencies, downloads voice models, and installs npm packages for frontend and backend.

### 3. Launch
Start both backend (Port 3001) and frontend (Port 5173) with a single command:
```bash
./run.sh
```

- **Web App**: `http://localhost:5173`
- **Backend API & WebSocket**: `http://localhost:3001`

---

## 📁 Repository Structure

```
communication-bot/
├── client/                     # React + Vite frontend
│   ├── src/
│   │   ├── components/         # Visualizer, Controls, ConversationView, SettingsModal, PracticeCard
│   │   ├── hooks/              # useAudioRecorder, useAudioPlayer, useWebSocket
│   │   ├── utils/              # 16kHz WAV encoder
│   │   └── App.jsx             # Main application & turn coordinator
├── server/                     # Node.js + Express backend
│   ├── server.js               # Express app & WebSocket server
│   ├── config.js               # System prompts, voice models, port config
│   ├── services/
│   │   ├── whisperService.js   # Whisper STT IPC client
│   │   ├── piperService.js     # TTS service router & Kokoro IPC client
│   │   └── ollamaService.js    # Streaming LLM client & sentence chunker
│   └── scripts/
│       ├── stt_worker.py       # Persistent Faster-Whisper worker
│       └── tts_worker.py       # Multi-threaded Kokoro ONNX TTS worker
├── models/
│   ├── kokoro/                 # Kokoro-v1.0 ONNX model & voice embeddings
│   └── piper/                  # Piper ONNX voice models
├── setup.sh                    # 1-click environment setup script
├── run.sh                      # 1-click startup script
├── pyrightconfig.json          # Python language server config
└── requirements.txt            # Python pip dependencies
```

---
