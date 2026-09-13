# FluentAI - Spoken English Practice Bot 🎙️

Real-time voice-to-voice conversational partner and English speaking coach. Supports casual English, mock job interviews, IELTS exam preparation, workplace negotiations, and debate practice.

The app supports two runtime modes: **Local** (runs offline/locally via WebSockets & Python workers) and **Production** (runs serverless on Vercel).

---

## ⚖️ Local vs. Production Differences

| Feature | 🖥️ Local Mode | ☁️ Production (Vercel) |
|---|---|---|
| **Networking** | Full-duplex WebSocket (`ws://localhost:3001`) | Serverless HTTP + SSE Streaming (`/api/*`) |
| **STT (Speech-to-Text)** | **Faster-Whisper** (`base.en`) via local Python daemon | **Groq Whisper** (`whisper-large-v3`) or OpenAI Whisper |
| **TTS (Text-to-Speech)** | **Kokoro-v1.0** multi-threaded ONNX neural voices | **Azure Edge Neural TTS** (`msedge-tts`) via `/api/tts` |
| **LLM Engine** | **OpenRouter** or **Ollama** (`gemma3:4b`) with auto-failover | **OpenRouter** or **Groq Llama 3.3** via SSE stream |
| **Default Voice** | Sarah (`af_sarah`) | Sarah (`en-US-AvaNeural`) |
| **Setup Required** | Python 3.10+, Node 18+, downloaded ONNX models | Just environment variables on Vercel |

---

## 🎯 Practice Modes

1. **Casual Conversation**: Everyday spoken English with natural follow-up questions.
2. **Job Interview**: Technical & behavioral mock interviews (MERN, React, Node.js, FYP defense, custom roles).
3. **IELTS Speaking**: 3-part exam simulation with Band score feedback (Band 5.0 – 9.0).
4. **Workplace & Negotiation**: Salary discussions, stakeholder pitches, sprint standups, conflict resolution.
5. **Debate Partner**: Oxford-style opponent that takes opposing viewpoints to sharpen rhetoric.

---

## 🖥️ Local Setup & Run

### 1. Prerequisites
- **Node.js** 18+
- **Python** 3.10+
- *(Optional)* [Ollama](https://ollama.com) if running models offline without an OpenRouter key:
  ```bash
  ollama pull gemma3:4b
  ```

### 2. Install & Download Models
Run the setup script from the project root:
```bash
./setup.sh
```
This initializes `venv/`, downloads required ONNX voice models (~300MB), and installs npm packages for both frontend and backend.

### 3. Local Environment (`.env`)
Create a `.env` file in the project root:
```env
PORT=3001
OPENROUTER_API_KEY="sk-or-v1-your-key-here"
OPENROUTER_MODEL="nex-agi/nex-n2.5-mini:free"
OLLAMA_URL="http://localhost:11434"
OLLAMA_MODEL="gemma3:4b"
```
> *If `OPENROUTER_API_KEY` is provided, it uses OpenRouter. If the key is omitted or quota is hit, it automatically falls back to local Ollama.*

### 4. Start Locally
```bash
./run.sh
```
- **Web App**: `http://localhost:5173`
- **Server**: `http://localhost:3001`

---

## ☁️ Production Deployment (Vercel)

The codebase includes serverless handlers in `/api` so it can be deployed on Vercel without needing Python or Docker:

### 1. Environment Variables on Vercel
Add the following in your **Vercel Project Settings ➔ Environment Variables**:

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | **Yes** | API key for OpenRouter LLM completions (`/api/chat`) |
| `GROQ_API_KEY` | **Yes** | API key for fast Whisper transcription (`/api/transcribe`) |
| `OPENROUTER_MODEL` | No | Model ID (defaults to `nex-agi/nex-n2.5-mini:free`) |
| `OPENAI_API_KEY` | No | Fallback for Whisper transcription if Groq is unavailable |

### 2. Deploy
Push to GitHub and connect the repository to Vercel. Vercel automatically runs:
```bash
cd client && npm install && npm run build
```
and routes requests:
- Frontend: Vite SPA static files
- Backend: `/api/chat`, `/api/transcribe`, `/api/tts`

---

## 📁 Project Structure

```
├── client/                 # React 18 + Vite frontend
│   ├── src/
│   │   ├── components/     # UI (Controls, Visualizer, Modals)
│   │   ├── hooks/          # useAudioRecorder, useAudioPlayer, useWebSocket
│   │   └── App.jsx         # Dual-mode controller (WebSocket / Serverless)
├── server/                 # Local Node.js backend
│   ├── server.js           # Express + WebSocket server
│   ├── config.js           # Configuration, voice personas & system prompts
│   ├── services/           # Whisper, Kokoro/Piper & Ollama services
│   └── scripts/            # Python daemons (stt_worker.py, tts_worker.py)
├── api/                    # Vercel serverless functions (chat, transcribe, tts)
├── models/                 # Local ONNX models (Kokoro TTS, Piper)
├── run.sh                  # One-command local startup
└── setup.sh                # Local environment initialization script
```

---

## 📄 License
MIT
