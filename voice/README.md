# Sokait voice

Spoken commentary for Sokait in six languages, using free
[Piper](https://github.com/OHF-Voice/piper1-gpl) neural voices that run on the CPU.
Browsers' built-in voices vary (Chrome on Linux has none, Firefox's are robotic), and for
blind and low-vision fans using Sokait Listen the voice is the product.

**Licence:** GPL-3.0-or-later, because Piper is GPL-3.0. It runs as a separate service
over HTTP, so the rest of Sokait keeps its own licence.

## Run

```sh
uv sync
for v in en_GB-northern_english_male-medium sw_CD-lanfrica-medium es_ES-davefx-medium \
         fr_FR-siwis-medium ar_JO-kareem-medium pt_BR-faber-medium; do
  uv run python -m piper.download_voices --download-dir voices "$v"
done
uv run uvicorn sokait_voice.server:app --port 8001
uv run pytest
```

The first line in each language loads that voice (a few seconds); after that a sentence
takes about 0.3 s. Recent lines are cached.

## API

- `GET /healthz`: languages with an installed voice.
- `POST /tts` with `{"text": "...", "language": "Swahili"}`: WAV audio, or 404 if that
  language has no voice. Set `VOICE_TOKEN` to require `Authorization: Bearer <token>`.
- `TTS_VOICE_DIR`: where voices live (default `voice/voices`).
- `VOICE_PRELOAD`: comma-separated languages to load at startup (default `English`).
