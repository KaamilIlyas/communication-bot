#!/usr/bin/env python3
"""
High-Performance Persistent Whisper STT Worker
Keeps Whisper model loaded in memory for sub-second transcription over stdin/stdout IPC.
"""
import sys
import json
import time
import os
import glob

# Ensure venv site-packages is in sys.path regardless of which python interpreter runs this script
script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(script_dir, "..", ".."))
venv_site_packages = glob.glob(os.path.join(root_dir, "venv", "lib", "python*", "site-packages"))
for p in venv_site_packages:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from faster_whisper import WhisperModel  # type: ignore
except ImportError:
    # If still not found, try fallback
    import site
    for p in venv_site_packages:
        site.addsitedir(p)
    from faster_whisper import WhisperModel  # type: ignore

MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base.en")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")

def log(msg):
    sys.stderr.write(f"[STT-Worker] {msg}\n")
    sys.stderr.flush()

def main():
    log(f"Loading Whisper model '{MODEL_SIZE}' on {DEVICE} ({COMPUTE_TYPE})...")
    start_time = time.time()
    try:
        model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
        log(f"Whisper model loaded in {time.time() - start_time:.2f}s.")
    except Exception as e:
        log(f"Failed to load Whisper model: {e}")
        print(json.dumps({"status": "error", "error": str(e)}), flush=True)
        sys.exit(1)

    # Notify Node.js parent process that STT worker is ready
    print(json.dumps({"status": "ready", "model": MODEL_SIZE}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            req_id = req.get("id", "")
            audio_path = req.get("audio_path", "")
            language = req.get("language", "en")
            
            if not audio_path or not os.path.exists(audio_path):
                print(json.dumps({
                    "id": req_id,
                    "status": "error",
                    "error": f"Audio file not found: {audio_path}"
                }), flush=True)
                continue

            t0 = time.time()
            segments, info = model.transcribe(
                audio_path,
                language=language,
                beam_size=1,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500)
            )
            text_segments = [s.text.strip() for s in segments if s.text.strip()]
            full_text = " ".join(text_segments).strip()
            elapsed = time.time() - t0

            log(f"Transcribed '{req_id}' in {elapsed:.2f}s: \"{full_text}\"")

            print(json.dumps({
                "id": req_id,
                "status": "ok",
                "text": full_text,
                "duration": elapsed,
                "detected_language": info.language if info else language,
                "language_prob": info.language_probability if info else 1.0
            }), flush=True)

        except Exception as err:
            log(f"Transcription error: {err}")
            print(json.dumps({
                # pyrefly: ignore [unbound-name]
                "id": req.get("id", "") if "req" in locals() else "",
                "status": "error",
                "error": str(err)
            }), flush=True)

if __name__ == "__main__":
    main()
