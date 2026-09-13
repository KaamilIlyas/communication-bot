import os
import subprocess
import sys
import urllib.request

print("==================================================")
print("🚀 Initializing English Speaking Bot on Hugging Face Spaces")
print("==================================================")

root_dir = os.path.dirname(os.path.abspath(__file__))
server_dir = os.path.join(root_dir, "server")

# Ensure PORT is 7860 for Hugging Face Spaces
os.environ["PORT"] = os.getenv("PORT", "7860")
os.environ["PYTHON_PATH"] = sys.executable

# 1. Ensure Kokoro TTS Neural Models are available
kokoro_dir = os.path.join(root_dir, "models", "kokoro")
os.makedirs(kokoro_dir, exist_ok=True)

model_onnx = os.path.join(kokoro_dir, "kokoro-v1.0.onnx")
voices_bin = os.path.join(kokoro_dir, "voices-v1.0.bin")

KOKORO_FILES = [
    ("kokoro-v1.0.onnx", model_onnx, "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"),
    ("voices-v1.0.bin", voices_bin, "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin")
]

for name, path, url in KOKORO_FILES:
    if not os.path.exists(path):
        print(f"⬇️ Downloading Kokoro TTS {name} (~300MB, one-time)...")
        urllib.request.urlretrieve(url, path)
        print(f"✅ {name} downloaded successfully!")

# 2. Install Node.js dependencies if needed
node_modules_path = os.path.join(server_dir, "node_modules")
if not os.path.exists(node_modules_path):
    print("📦 Installing server npm dependencies...")
    subprocess.run(["npm", "install", "--prefix", "server"], check=True)

# 3. Launch the Node.js backend server
print(f"⚡ Starting Node.js backend on port {os.environ['PORT']}...")
server_path = os.path.join(server_dir, "server.js")
process = subprocess.Popen(["node", server_path])

# Wait for process
try:
    process.wait()
except KeyboardInterrupt:
    process.terminate()
