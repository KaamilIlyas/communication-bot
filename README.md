# FluentAI

A real-time voice-to-voice speaking coach and conversational practice bot. Features hands-free Voice Activity Detection (VAD), low-latency audio streaming, and practice scenarios for interviews, exams, and workplace communication.

**Live Demo:** [https://fluentai-bot.vercel.app](https://fluentai-bot.vercel.app/)

Supports both offline local execution (WebSockets + Python workers) and serverless cloud deployment (Vercel + Groq/Azure Edge TTS).

## Features

- **Practice Scenarios**: Casual conversation, software engineering mock interviews (React, Node, MERN), IELTS 3-part exam preparation with score feedback, workplace negotiations, and debate practice.
- **Hands-Free Conversation**: Voice Activity Detection (VAD) automatically detects when you finish speaking and starts generation.
- **Dual Runtime Architecture**:
  - **Local Mode**: WebSockets (`ws://localhost:3001`), local Faster-Whisper (`base.en`), and Kokoro ONNX neural TTS for low-latency offline voice synthesis.
  - **Production Mode**: Serverless HTTP/SSE streaming on Vercel using Groq Whisper and Azure Edge TTS.

## Tech Stack

- **Frontend**: React 18, Vite, Web Audio API, Tailwind CSS
- **Backend**: Node.js, Express, WebSockets, Python daemons (local mode)
- **Speech & AI**: Faster-Whisper / Groq Whisper, Kokoro TTS / Azure Edge TTS, OpenRouter / Ollama

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+ (for local STT/TTS workers)

### Local Setup

1. Run the initialization script (sets up Python virtual environment and downloads ONNX voice models):
   ```bash
   ./setup.sh
   ```

2. Create a `.env` file in the root directory:
   ```env
   PORT=3001
   OPENROUTER_API_KEY=your_openrouter_api_key
   # Optional offline fallback:
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=gemma3:4b
   ```

3. Start the application:
   ```bash
   ./run.sh
   ```
   - Client: `http://localhost:5173`
   - Server: `http://localhost:3001`

### Vercel Deployment

Deploy the repository to Vercel and configure the following environment variables:
- `OPENROUTER_API_KEY`: API key for LLM chat completions
- `GROQ_API_KEY`: API key for Whisper speech-to-text transcription

## License

MIT
