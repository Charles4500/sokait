"""Text to speech with Piper: free, open-source neural voices that run on the CPU.

Browsers' built-in voices vary wildly (Chrome on Linux has none), and for blind fans the
voice is the product, so Sokait can always speak for itself. Voices live in
TTS_VOICE_DIR (default voice/voices); download them with
`uv run python -m piper.download_voices --download-dir voices <voice>`.
"""

from __future__ import annotations

import asyncio
import io
import os
import threading
import wave
from collections import OrderedDict
from pathlib import Path

VOICES = {
    "English": "en_GB-northern_english_male-medium",
    "Swahili": "sw_CD-lanfrica-medium",
    "Spanish": "es_ES-davefx-medium",
    "French": "fr_FR-siwis-medium",
    "Arabic": "ar_JO-kareem-medium",
    "Portuguese": "pt_BR-faber-medium",
}
MAX_CHARS = 400


def voice_dir() -> Path:
    default = Path(__file__).resolve().parents[2] / "voices"
    return Path(os.getenv("TTS_VOICE_DIR", default))


class Speaker:
    def __init__(self, cache_items: int = 256) -> None:
        self._voices: dict[str, object] = {}
        self._lock = threading.Lock()
        self._cache: OrderedDict[tuple[str, str], bytes] = OrderedDict()
        self._cache_items = cache_items

    def available(self) -> list[str]:
        return [
            lang for lang, v in VOICES.items() if (voice_dir() / f"{v}.onnx").exists()
        ]

    async def speak(self, text: str, language: str) -> bytes | None:
        """WAV bytes, or None when no voice is installed for the language."""
        text = " ".join(text.split())[:MAX_CHARS]
        key = (language, text)
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        audio = await asyncio.to_thread(self._synthesize, text, language)
        if audio:
            self._cache[key] = audio
            while len(self._cache) > self._cache_items:
                self._cache.popitem(last=False)
        return audio

    def _synthesize(self, text: str, language: str) -> bytes | None:
        name = VOICES.get(language)
        path = voice_dir() / f"{name}.onnx"
        if not name or not path.exists():
            return None
        with self._lock:  # one model run at a time keeps memory flat on small machines
            voice = self._voices.get(language)
            if voice is None:
                from piper import PiperVoice

                voice = self._voices[language] = PiperVoice.load(path)
            buf = io.BytesIO()
            with wave.open(buf, "wb") as wav:
                voice.synthesize_wav(text, wav)  # type: ignore[attr-defined]
        return buf.getvalue()
