FROM oven/bun:1.3.11 AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
# --ignore-scripts: "prepare" installs git hooks, which a container has no use for.
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun run build

# Nitro's node-server output is self-contained: no node_modules needed at runtime.
FROM node:24-slim
WORKDIR /app
COPY --from=build /app/.output ./.output
ENV NODE_ENV=production PORT=3000
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
