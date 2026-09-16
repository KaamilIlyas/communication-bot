# 📘 FluentAI: Complete Project Architecture & Tools Guide

> **Purpose of this document**: A simple, clear, 1–2 page reference guide explaining how this conversational voice AI bot works under the hood, what tools and technologies are used, and how each tool operates. Save this file to review before interviews or project demos.

---

## 1. What is this Project?

**FluentAI** is a real-time, voice-to-voice AI English speaking coach. Instead of typing into a chatbot like ChatGPT and reading paragraphs of text, you speak into your microphone and the AI responds back in real-time with spoken human voice.

It supports two runtime modes:
1. **Local Mode**: Runs 100% on your laptop using Python background workers and local ONNX AI models (private, no internet required).
2. **Cloud Mode (Production)**: Runs serverless on Vercel using high-speed free cloud APIs.

---

## 2. The 3 Core Pillars of the Application

Every voice AI bot relies on three consecutive steps:

```
[Your Voice] ──▶ 1. Speech-to-Text (Ear) ──▶ 2. LLM (Brain) ──▶ 3. Text-to-Speech (Mouth) ──▶ [AI Audio]
```

1. **The Ear (Speech-to-Text)**: Listens to sound waves from your microphone and converts them into written words.
2. **The Brain (Language Model)**: Reads your words, understands context, decides what role to play (Job Interviewer, IELTS Examiner, Friend), and writes a spoken reply.
3. **The Mouth (Text-to-Speech)**: Takes the AI’s written words and synthesizes them into realistic human speech audio.

---

## 3. What Tools Are We Using & How Do They Work?

### A. The User Interface & Audio Capture

| Tool | What It Does | How It Works in Simple Words |
|---|---|---|
| **React 18** | Web Frontend | Manages all visual states (buttons, chat history, voice wave animations, settings modal). |
| **Vite** | Build Tool | Extremely fast development server that bundles our JavaScript and CSS in milliseconds. |
| **Web Audio API** | Audio Processing in Browser | Directly hooks into your microphone hardware. It captures raw sound waves, downsamples them to **16,000 Hz Mono WAV** (the standard format AI speech models expect), and measures your voice volume (RMS) to draw the visualizer glow. |

---

### B. Speech-to-Text (STT) — "The Ear"

| Tool | Environment | How It Works |
|---|---|---|
| **Faster-Whisper (`base.en`)** | **Local** | A lightweight version of OpenAI's Whisper model optimized with CTranslate2. It runs as a persistent background Python daemon in your RAM, transcribing audio in under 0.8 seconds. |
| **Silero VAD** | **Local & Cloud** | *Voice Activity Detection*. It acts as a gatekeeper: if you only breathe or your laptop fan makes noise, Silero VAD discards the noise so Whisper doesn't hallucinate fake words like *"Thank you for watching"*. |
| **Groq Cloud Whisper** | **Production** | Runs `whisper-large-v3-turbo` on specialized high-speed hardware chips (LPUs) in the cloud with ~200ms latency on a 100% free tier. |

---

### C. The Artificial Intelligence — "The Brain"

| Tool | What It Does | How It Works |
|---|---|---|
| **OpenRouter API** | Cloud LLM Router | Connects to state-of-the-art open models (like `nex-n2.5-mini`, Llama 3.3, Gemini Flash) without needing credit cards or subscriptions. |
| **Ollama (`gemma3:4b`)** | Offline Local LLM | Runs Google’s Gemma 3 model locally on your laptop's CPU/GPU when offline. |
| **Bidirectional Failover** | Reliability Logic | If you select local Ollama but forget to run it, or if OpenRouter runs out of requests, our server detects the error and automatically routes to the other provider without crashing. |
| **Sentence-Level Streamer** | Speed Optimization | Instead of waiting for the AI to finish writing a whole paragraph, our code cuts the stream at the very first sentence (`.`, `?`, `!`) and sends it to the voice engine immediately. |

---

### D. Text-to-Speech (TTS) — "The Mouth"

| Tool | Environment | How It Works |
|---|---|---|
| **Kokoro-v1.0** | **Local** | An 82-million parameter neural voice model running directly via ONNX Runtime on your CPU. Produces lifelike human voices (Sarah, Adam, Heart, George) without sounding robotic. |
| **Azure Edge Neural TTS (`msedge-tts`)** | **Production** | Connects to Microsoft's high-speed neural voice service. It is completely free, requires no API key, and provides studio-grade human voices (`en-US-AvaNeural`, `en-US-JennyNeural`, etc.). |
| **Web Speech API** | Fallback | Built-in browser speech engine that acts as an emergency fallback if network disconnects. |

---

### E. Networking & Coordination

| Tool | Where Used | How It Works |
|---|---|---|
| **WebSockets (`ws`)** | Local Mode | A 2-way open highway between React and Node.js. It streams binary microphone chunks and audio packets back and forth with zero connection delays. |
| **Server-Sent Events (SSE)** | Production Mode | A lightweight streaming protocol used by Vercel serverless functions to stream words from LLM directly into the user's screen in real time. |

---

## 4. The Lifecycle of a Single Conversation Turn

Here is the exact journey from the moment you speak to the moment the AI replies:

```
 1. You speak: "Hello, how does the event loop work in Node.js?"
       │
       ▼
 2. Web Audio API captures sound waves at 16kHz Mono.
       │
       ▼
 3. Smart VAD detects you paused for 2.0 seconds (turn finished).
       │
       ▼
 4. Whisper STT transcribes the audio into text (under 0.8s).
       │
       ▼
 5. Text is injected into the selected Persona prompt (e.g. Senior Tech Lead).
       │
       ▼
 6. LLM streams tokens: "The Node.js event loop handles non-blocking I/O operations."
       │
       ▼
 7. Sentence chunker grabs Sentence #1 and sends it to the TTS Voice Engine.
       │
       ▼
 8. Neural TTS synthesizes human voice audio in parallel.
       │
       ▼
 9. Audio plays through your speakers; glowing visualizer reacts to frequencies.
       │
       ▼
10. AI finishes speaking -> Mic automatically opens back up for your reply!
```

---

## 5. Smart Features Built to Handle Real-World Edge Cases

1. **Hands-Free Silence Detection (2-Second VAD)**:
   - You don't have to click buttons back and forth. You just speak naturally like a real phone call. When you stop talking for 2 seconds, it sends your speech.
2. **Inactivity Auto-Stop (No Hallucinations)**:
   - If the mic turns on and you stay silent for 4.5 seconds (you didn't reply), it automatically turns off. It will never guess or talk to itself.
3. **Instant Barge-In (Interrupt)**:
   - If the AI is giving a long answer and you want to stop it, you can tap the Stop button or start speaking again. It aborts the generation immediately using an `AbortController`.
4. **5 Purpose-Built Practice Modes**:
   - **Casual Talk**: Everyday topics with friendly follow-ups.
   - **Job Interview**: Real MERN/Frontend/Backend technical & STAR behavioral questions.
   - **IELTS Speaking**: Official 3-part test with estimated Band Score (5.0–9.0).
   - **Workplace & Negotiation**: Salary pitches, sprint standups, and deadline pushbacks.
   - **Debate Partner**: Oxford-style opponent that challenges your arguments.

---

## 6. How to Run (Quick Cheat Sheet)

### Local Development:
```bash
./run.sh
```
- App: `http://localhost:5173`
- Server: `http://localhost:3001`

### Production Deployment (Vercel):
1. Push code to GitHub.
2. Link repo to Vercel.
3. Add Environment Variables in Vercel:
   - `OPENROUTER_API_KEY` (Get free at [openrouter.ai](https://openrouter.ai))
   - `GROQ_API_KEY` (Get free at [console.groq.com](https://console.groq.com))
4. Done! Vercel automatically deploys your project.
