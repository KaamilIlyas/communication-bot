#!/usr/bin/env python3
"""
High-Performance Persistent Kokoro & Piper TTS Worker Daemon
Keeps Kokoro-v1.0 (State of the Art Neural Voices) warm in memory for instantaneous, human-like voice synthesis.
"""
import sys
import json
import time
import os
import io
import glob

# Ensure venv site-packages is in sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(script_dir, "..", ".."))
venv_site_packages = glob.glob(os.path.join(root_dir, "venv", "lib", "python*", "site-packages"))
for p in venv_site_packages:
    if p not in sys.path:
        sys.path.insert(0, p)

import base64
import soundfile as sf  # type: ignore
from kokoro_onnx import Kokoro  # type: ignore

MODEL_PATH = os.path.join(root_dir, "models", "kokoro", "kokoro-v1.0.onnx")
VOICES_PATH = os.path.join(root_dir, "models", "kokoro", "voices-v1.0.bin")

def log(msg):
    sys.stderr.write(f"[TTS-Worker] {msg}\n")
    sys.stderr.flush()

def clean_text_for_speech(text):
    if not text:
        return ""
    import re
    cleaned = re.sub(r'\[CORRECTION:.*?\]', '', text, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r'\*\*([^*]+)\*\*', r'\1', cleaned)
    cleaned = re.sub(r'\*([^*]+)\*', r'\1', cleaned)
    cleaned = re.sub(r'`([^`]+)`', r'\1', cleaned)
    cleaned = re.sub(r'#{1,6}\s+', '', cleaned)
    cleaned = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', cleaned)
    cleaned = re.sub(r'[\U00010000-\U0010ffff]', '', cleaned)
    return re.sub(r'\s+', ' ', cleaned).strip()

def main():
    log(f"Loading Kokoro neural TTS model from {MODEL_PATH}...")
    start_time = time.time()
    try:
        kokoro = Kokoro(MODEL_PATH, VOICES_PATH)
        log(f"Kokoro neural TTS loaded in {time.time() - start_time:.2f}s.")
    except Exception as e:
        log(f"Failed to load Kokoro model: {e}")
        print(json.dumps({"status": "error", "error": str(e)}), flush=True)
        sys.exit(1)

    # Warmup with short word
    try:
        kokoro.create("Hi", voice="af_heart", speed=1.0, lang="en-us")
    except Exception:
        pass

    # Ready marker
    print(json.dumps({"status": "ready", "engine": "kokoro-v1.0"}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            req_id = req.get("id", "")
            raw_text = req.get("text", "")
            voice = req.get("voice", "af_heart")
            speed = float(req.get("speed", 1.0))
            
            cleaned = clean_text_for_speech(raw_text)
            if not cleaned:
                print(json.dumps({"id": req_id, "status": "ok", "audio": ""}), flush=True)
                continue

            lang = "en-gb" if voice.startswith("b") else "en-us"
            t0 = time.time()
            samples, sample_rate = kokoro.create(cleaned, voice=voice, speed=speed, lang=lang)
            
            # Write WAV into memory buffer
            wav_io = io.BytesIO()
            sf.write(wav_io, samples, sample_rate, format='WAV')
            wav_bytes = wav_io.getvalue()
            b64_audio = base64.b64encode(wav_bytes).decode('ascii')
            elapsed = time.time() - t0

            log(f"Synthesized '{req_id}' ({voice}) in {elapsed:.2f}s ({len(samples)/sample_rate:.2f}s audio)")

            print(json.dumps({
                "id": req_id,
                "status": "ok",
                "audio": b64_audio,
                "duration": elapsed
            }), flush=True)

        except Exception as err:
            log(f"TTS synthesis error: {err}")
            print(json.dumps({
                # pyrefly: ignore [unbound-name]
                "id": req.get("id", "") if "req" in locals() else "",
                "status": "error",
                "error": str(err)
            }), flush=True)

if __name__ == "__main__":
    main()
