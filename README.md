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

## 🎯 Conversational Modes & Simulation Scenarios

The bot features 5 specialized operational modes for speaking fluency, exam preparation, and career growth:

### 1. 💬 Casual Conversation
- **Persona**: Warm, charismatic, and witty conversational partner.
- **Focus**: Spontaneous everyday English conversation (travel, food, hobbies, pop culture, philosophical thoughts).
- **Format**: Short, lively 1–2 sentence spoken turns with natural follow-up questions.

### 2. 💼 Job Interview Simulator
- **Persona**: Senior Tech Lead & Technical Hiring Manager.
- **Role Presets**:
  - 🚀 **Full-Stack MERN Developer**: React hooks/lifecycle, Node.js event loop, Express middleware, MongoDB schema/aggregation, REST APIs.
  - 🎓 **Final Year Project (FYP) & Portfolio Defense**: Architectural decisions, DB tradeoffs, authentication, deployment challenges.
  - ⚛️ **Frontend React & UI**: Component optimization, Virtual DOM, CSS performance, state management.
  - 🛠️ **Backend & Database**: Indexing, query optimization, non-blocking I/O, security, microservices.
  - ✏️ **Custom Target Role**: Set any custom job title (e.g. AI Engineer, DevOps, Product Manager).

### 3. 🎓 IELTS / TOEFL Speaking Exam Simulator
- **Persona**: Certified British Council / IDP IELTS Speaking Examiner.
- **Exam Stages**:
  - 📋 **Full Exam (Parts 1–3)**: Comprehensive 3-part simulation with final Band score evaluation.
  - 🗣️ **Part 1 (General Q&A)**: Everyday topics (hometown, studies, hobbies, daily routines).
  - ⏱️ **Part 2 (Cue Card)**: 1-minute preparation guidance and 2-minute uninterrupted speech prompts.
  - 💡 **Part 3 (In-Depth Discussion)**: Analytical, abstract questions on societal and global issues.
- **Band Score Estimation**: Provides estimated Band scores (Band 5.0 – 9.0) on Fluency, Lexical Resource, Grammar Range, and Pronunciation.

### 4. 🏢 Workplace Situations & Negotiations
- **Persona**: Corporate Executive & Negotiation Coach.
- **Scenarios**:
  - 💰 **Salary & Promotion Negotiation**: Present achievements with measurable metrics; handle counter-offers politely.
  - 📊 **Executive & Client Pitch**: Pitch technical proposals and defend architectural decisions.
  - ⏱️ **Agile Sprint Standup & Demo**: Deliver concise updates, report blockers, and demo new features.
  - 🤝 **Conflict Resolution & Pushback**: Negotiate unrealistic deadlines and resolve team disagreements.

### 5. ⚔️ AI Debate Partner
- **Persona**: Oxford-style sharp, respectful, and articulate debater.
- **Focus Topics**:
  - 🤖 **AI vs Human Software Engineers**: Will AI replace developers or amplify creativity?
  - 🏡 **Remote Work vs In-Office**: Productivity, culture, and developer satisfaction.
  - 🏗️ **Microservices vs Monoliths**: Scalability vs operational complexity.
  - 📱 **Social Media Impact**: Information democratization vs cognitive focus and mental health.
- **Rhetoric Training**: Takes the opposing stance to train fast critical thinking, reasoning, and persuasive vocabulary.

---

## 🚀 Key Features

- **⚡ Sub-Second Voice Response**: First phrase begins synthesizing in ~100ms, starting playback in ~0.5s.
- **✨ Speech-Synchronized Text (Lockstep Display)**: Text appears on screen in real-time as words are spoken, keeping visuals and audio aligned.
- **🗣️ State-of-the-Art Neural Voices**: Ultra-realistic Kokoro voices (Heart, Adam, Bella, George, Emma, Sarah, Michael).
- **💼 Interactive Scenario Selector**: 1-click preset switching for interviews, IELTS tests, workplace negotiations, and debates.
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
