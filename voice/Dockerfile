FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11.8 /uv /bin/uv

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN uv sync --frozen --no-dev

# One Piper voice per supported language (about 360 MB).
RUN /app/.venv/bin/python -m piper.download_voices --download-dir /app/voices \
      en_GB-northern_english_male-medium sw_CD-lanfrica-medium es_ES-davefx-medium \
      fr_FR-siwis-medium ar_JO-kareem-medium pt_BR-faber-medium
ENV TTS_VOICE_DIR=/app/voices

RUN useradd --create-home app
USER app
EXPOSE 8001
CMD ["/app/.venv/bin/uvicorn", "sokait_voice.server:app", "--host", "0.0.0.0", "--port", "8001"]
