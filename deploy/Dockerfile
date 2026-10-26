# Sokait in one container, for a single-service host such as Render's free tier: the
# web app on $PORT, the agent service (and optionally the voice service) on localhost.
#   docker build -f deploy/Dockerfile .                       # web + agents (~150 MB RAM)
#   docker build -f deploy/Dockerfile --build-arg WITH_VOICE=1 .   # + Piper voices (~500 MB)
FROM oven/bun:1.3.11 AS web
WORKDIR /src
COPY web/package.json web/bun.lock web/bunfig.toml ./
# --ignore-scripts: "prepare" installs git hooks, which a container has no use for.
RUN bun install --frozen-lockfile --ignore-scripts
COPY web/ ./
RUN bun run build

FROM node:24-slim
ARG WITH_VOICE=0
COPY --from=ghcr.io/astral-sh/uv:0.11.8 /uv /bin/uv
# The slim image has no CA certificates; model calls and voice downloads need HTTPS.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Run as the image's unprivileged "node" user (uid 1000).
USER node
WORKDIR /home/node/app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_INSTALL_DIR=/home/node/python

COPY --chown=node agents/pyproject.toml agents/uv.lock agents/
RUN cd agents && uv sync --frozen --no-dev --no-install-project --python 3.12
COPY --chown=node agents/src agents/src
RUN cd agents && uv sync --frozen --no-dev

COPY --chown=node voice/pyproject.toml voice/uv.lock voice/README.md voice/
COPY --chown=node voice/src voice/src
# One Piper voice per supported language (about 360 MB), only when asked for.
RUN if [ "$WITH_VOICE" = 1 ]; then \
      cd voice && uv sync --frozen --no-dev --python 3.12 \
      && .venv/bin/python -m piper.download_voices --download-dir ../voices \
         en_GB-northern_english_male-medium sw_CD-lanfrica-medium es_ES-davefx-medium \
         fr_FR-siwis-medium ar_JO-kareem-medium pt_BR-faber-medium; \
    fi

COPY --chown=node --from=web /src/.output web/.output
COPY --chown=node deploy/start.sh ./

# Models: Groq first, then Gemini. Keys come from the host's secret settings
# (OPENAI_API_KEY, GEMINI_API_KEY); without them the agents use the offline client.
ENV NODE_ENV=production PORT=10000 \
    TTS_VOICE_DIR=/home/node/app/voices VOICE_PRELOAD=English \
    OPENAI_BASE_URL=https://api.groq.com/openai/v1 OPENAI_REASONING_EFFORT=low \
    OPENAI_MODEL_ANALYST=openai/gpt-oss-20b,openai/gpt-oss-120b,gemini:gemini-3.5-flash-lite,gemini:gemini-3.5-flash,gemini:gemini-3.1-flash-lite \
    OPENAI_MODEL_NARRATOR=openai/gpt-oss-120b,openai/gpt-oss-20b,gemini:gemini-3.5-flash-lite,gemini:gemini-3.5-flash,gemini:gemini-3.1-flash-lite \
    OPENAI_MODEL_QA=openai/gpt-oss-120b,openai/gpt-oss-20b,gemini:gemini-3.5-flash-lite,gemini:gemini-3.5-flash,gemini:gemini-3.1-flash-lite \
    OPENAI_MODEL_RECAP=openai/gpt-oss-120b,openai/gpt-oss-20b,gemini:gemini-3.5-flash-lite,gemini:gemini-3.5-flash,gemini:gemini-3.1-flash-lite
EXPOSE 10000
CMD ["bash", "start.sh"]
