# All three Sokait services in one container, for a Hugging Face Docker Space:
# the web app on the public port, the agent and voice services on localhost beside it.
FROM oven/bun:1.3.11 AS web
WORKDIR /src
COPY web/package.json web/bun.lock web/bunfig.toml ./
# --ignore-scripts: "prepare" installs git hooks, which a container has no use for.
RUN bun install --frozen-lockfile --ignore-scripts
COPY web/ ./
RUN bun run build

FROM node:24-slim
COPY --from=ghcr.io/astral-sh/uv:0.11.8 /uv /bin/uv
# The slim image has no CA certificates; the voice download needs HTTPS.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Spaces run the container as uid 1000, which is the image's "node" user.
USER node
WORKDIR /home/node/app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_INSTALL_DIR=/home/node/python

COPY --chown=node agents/pyproject.toml agents/uv.lock agents/
RUN cd agents && uv sync --frozen --no-dev --no-install-project --python 3.12
COPY --chown=node agents/src agents/src
RUN cd agents && uv sync --frozen --no-dev

COPY --chown=node voice/pyproject.toml voice/uv.lock voice/README.md voice/
RUN cd voice && uv sync --frozen --no-dev --no-install-project --python 3.12
COPY --chown=node voice/src voice/src
RUN cd voice && uv sync --frozen --no-dev
# One Piper voice per supported language (about 360 MB).
RUN voice/.venv/bin/python -m piper.download_voices --download-dir voices \
      en_GB-northern_english_male-medium sw_CD-lanfrica-medium es_ES-davefx-medium \
      fr_FR-siwis-medium ar_JO-kareem-medium pt_BR-faber-medium

COPY --chown=node --from=web /src/.output web/.output
COPY --chown=node start.sh ./

# Models: Groq first, then Gemini. The keys are Space secrets (OPENAI_API_KEY,
# GEMINI_API_KEY); without them the agents fall back to the offline client.
ENV NODE_ENV=production PORT=7860 \
    TTS_VOICE_DIR=/home/node/app/voices VOICE_PRELOAD=English,Swahili \
    OPENAI_BASE_URL=https://api.groq.com/openai/v1 OPENAI_REASONING_EFFORT=low \
    OPENAI_MODEL_ANALYST=openai/gpt-oss-20b,openai/gpt-oss-120b,gemini:gemini-3.5-flash-lite,gemini:gemini-3.5-flash,gemini:gemini-3.1-flash-lite \
    OPENAI_MODEL_NARRATOR=openai/gpt-oss-120b,openai/gpt-oss-20b,gemini:gemini-3.5-flash-lite,gemini:gemini-3.5-flash,gemini:gemini-3.1-flash-lite \
    OPENAI_MODEL_QA=openai/gpt-oss-120b,openai/gpt-oss-20b,gemini:gemini-3.5-flash-lite,gemini:gemini-3.5-flash,gemini:gemini-3.1-flash-lite \
    OPENAI_MODEL_RECAP=openai/gpt-oss-120b,openai/gpt-oss-20b,gemini:gemini-3.5-flash-lite,gemini:gemini-3.5-flash,gemini:gemini-3.1-flash-lite
EXPOSE 7860
CMD ["bash", "start.sh"]
