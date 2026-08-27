#!/usr/bin/env bash
set -e

echo "========================================================"
echo "  🎙️  English Voice AI - Local Environment Setup"
echo "========================================================"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# 1. Check Python
PYTHON_BIN=""
if command -v python3.13 &>/dev/null; then
    PYTHON_BIN="python3.13"
elif [ -f "/usr/local/opt/python@3.13/bin/python3.13" ]; then
    PYTHON_BIN="/usr/local/opt/python@3.13/bin/python3.13"
elif command -v python3 &>/dev/null; then
    PYTHON_BIN="python3"
else
    echo "❌ Error: Python 3 is required. Please install Python 3.11+."
    exit 1
fi

echo "✅ Using Python: $($PYTHON_BIN --version)"

# 2. Setup Virtual Environment
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment in ./venv..."
    $PYTHON_BIN -m venv venv
fi

echo "📦 Installing Python dependencies (faster-whisper, piper-tts)..."
./venv/bin/pip install --upgrade pip
./venv/bin/pip install faster-whisper piper-tts

# 3. Download Piper ONNX Voice Models
mkdir -p models/piper
cd models/piper

echo "🗣️  Checking Piper voice models..."
for voice in "en_US-lessac-medium" "en_US-amy-medium" "en_US-ryan-medium"; do
    if [ ! -f "${voice}.onnx" ]; then
        echo "⬇️  Downloading voice model: ${voice}..."
        LANG_CODE=$(echo $voice | cut -d'-' -f1)
        VOICE_NAME=$(echo $voice | cut -d'-' -f2)
        QUALITY=$(echo $voice | cut -d'-' -f3)
        BASE_LANG=$(echo $LANG_CODE | cut -d'_' -f1)
        curl -L -s -O "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/${BASE_LANG}/${LANG_CODE}/${VOICE_NAME}/${QUALITY}/${voice}.onnx"
        curl -L -s -O "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/${BASE_LANG}/${LANG_CODE}/${VOICE_NAME}/${QUALITY}/${voice}.onnx.json"
    fi
done

cd "$ROOT_DIR"

# 4. Check Ollama
echo "🤖 Checking Ollama and gemma3:4b..."
if command -v ollama &>/dev/null; then
    if ollama list | grep -q "gemma3:4b"; then
        echo "✅ Ollama model gemma3:4b is ready!"
    else
        echo "⬇️  Pulling gemma3:4b in Ollama..."
        ollama pull gemma3:4b
    fi
else
    echo "⚠️  Warning: Ollama command not found in PATH. Please ensure Ollama is installed from https://ollama.com."
fi

# 5. Install Node Dependencies
echo "📦 Installing Node.js backend dependencies..."
npm --prefix server install --cache /tmp/npm-cache

echo "📦 Installing React frontend dependencies..."
npm --prefix client install --cache /tmp/npm-cache

echo "========================================================"
echo "🎉 Setup complete! Run './run.sh' to launch the app."
echo "========================================================"
