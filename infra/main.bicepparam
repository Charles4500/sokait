// Secrets come from the shell, never from this file:
//   export OPENAI_API_KEY=... GEMINI_API_KEY=... AGENTS_TOKEN=$(openssl rand -hex 24) VOICE_TOKEN=$(openssl rand -hex 24)
using 'main.bicep'

param webImage = 'ghcr.io/charles4500/sokait-web:latest'
param agentsImage = 'ghcr.io/charles4500/sokait-agents:latest'
param voiceImage = 'ghcr.io/charles4500/sokait-voice:latest'

param openaiApiKey = readEnvironmentVariable('OPENAI_API_KEY', '')
param geminiApiKey = readEnvironmentVariable('GEMINI_API_KEY', '')
param agentsToken = readEnvironmentVariable('AGENTS_TOKEN')
param voiceToken = readEnvironmentVariable('VOICE_TOKEN')

// Microsoft Foundry instead of the OpenAI-compatible models:
// param foundryProjectEndpoint = 'https://<resource>.services.ai.azure.com/api/projects/<project>'
// param foundryModel = 'gpt-4o-mini'
