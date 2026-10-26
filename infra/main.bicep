// Sokait on Azure Container Apps: the web app (public), the agent service and the
// voice service (internal), in one Container Apps environment with Log Analytics.
//
//   az group create -n sokait -l westeurope
//   az deployment group create -g sokait -f infra/main.bicep -p infra/main.bicepparam
//
// The match hub, caches and token budget live in memory, so each app runs one replica.

@description('Azure region for every resource.')
param location string = resourceGroup().location

@description('Prefix for resource names.')
param name string = 'sokait'

@description('Container images, e.g. ghcr.io/<owner>/sokait-web:<tag>.')
param webImage string
param agentsImage string
param voiceImage string

@description('Microsoft Foundry project endpoint. When set, the agents use Foundry through the app\'s managed identity and the OpenAI-compatible settings are ignored.')
param foundryProjectEndpoint string = ''
param foundryModel string = ''

@description('OpenAI-compatible endpoint (default: Groq) and key.')
param openaiBaseUrl string = 'https://api.groq.com/openai/v1'
@secure()
param openaiApiKey string = ''
@secure()
param geminiApiKey string = ''

@description('Per-agent model lists; each fails over in order when a model is rate-limited.')
param analystModels string = 'openai/gpt-oss-20b,openai/gpt-oss-120b,gemini:gemini-3.5-flash-lite,gemini:gemini-3.5-flash'
param narratorModels string = 'openai/gpt-oss-120b,openai/gpt-oss-20b,gemini:gemini-3.5-flash-lite,gemini:gemini-3.5-flash'

@description('Shared secrets between the web app and the internal services.')
@secure()
param agentsToken string
@secure()
param voiceToken string

@description('Languages the voice service loads at startup.')
param voicePreload string = 'English,Swahili'

var optionalSecrets = concat(
  empty(openaiApiKey) ? [] : [{ name: 'openai-api-key', value: openaiApiKey }],
  empty(geminiApiKey) ? [] : [{ name: 'gemini-api-key', value: geminiApiKey }]
)
var optionalSecretEnv = concat(
  empty(openaiApiKey) ? [] : [{ name: 'OPENAI_API_KEY', secretRef: 'openai-api-key' }],
  empty(geminiApiKey) ? [] : [{ name: 'GEMINI_API_KEY', secretRef: 'gemini-api-key' }]
)
var foundryEnv = empty(foundryProjectEndpoint)
  ? []
  : [
      { name: 'FOUNDRY_PROJECT_ENDPOINT', value: foundryProjectEndpoint }
      { name: 'FOUNDRY_MODEL', value: foundryModel }
    ]
var single = { minReplicas: 1, maxReplicas: 1 }

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${name}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${name}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

resource agents 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${name}-agents'
  location: location
  identity: { type: 'SystemAssigned' } // for Microsoft Foundry
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      // Internal only: reached by the web app at http://<name>-agents.
      ingress: { external: false, targetPort: 8000, allowInsecure: true }
      secrets: concat([{ name: 'agents-token', value: agentsToken }], optionalSecrets)
    }
    template: {
      containers: [
        {
          name: 'agents'
          image: agentsImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: concat(
            [
              { name: 'AGENTS_TOKEN', secretRef: 'agents-token' }
              { name: 'OPENAI_BASE_URL', value: openaiBaseUrl }
              { name: 'OPENAI_REASONING_EFFORT', value: 'low' }
              { name: 'OPENAI_MODEL_ANALYST', value: analystModels }
              { name: 'OPENAI_MODEL_NARRATOR', value: narratorModels }
              { name: 'OPENAI_MODEL_QA', value: narratorModels }
              { name: 'OPENAI_MODEL_RECAP', value: narratorModels }
            ],
            optionalSecretEnv,
            foundryEnv
          )
          probes: [
            { type: 'Liveness', httpGet: { path: '/healthz', port: 8000 } }
          ]
        }
      ]
      scale: single
    }
  }
}

resource voice 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${name}-voice'
  location: location
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: { external: false, targetPort: 8001, allowInsecure: true }
      secrets: [{ name: 'voice-token', value: voiceToken }]
    }
    template: {
      containers: [
        {
          name: 'voice'
          image: voiceImage
          resources: { cpu: json('1.0'), memory: '2Gi' }
          env: [
            { name: 'VOICE_TOKEN', secretRef: 'voice-token' }
            { name: 'VOICE_PRELOAD', value: voicePreload }
          ]
        }
      ]
      scale: single
    }
  }
}

resource web 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${name}-web'
  location: location
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: { external: true, targetPort: 3000 }
      secrets: [
        { name: 'agents-token', value: agentsToken }
        { name: 'voice-token', value: voiceToken }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: webImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'AGENTS_URL', value: 'http://${agents.name}' }
            { name: 'AGENTS_TOKEN', secretRef: 'agents-token' }
            { name: 'VOICE_URL', value: 'http://${voice.name}' }
            { name: 'VOICE_TOKEN', secretRef: 'voice-token' }
          ]
        }
      ]
      scale: single
    }
  }
}

output webUrl string = 'https://${web.properties.configuration.ingress.fqdn}'
output agentsPrincipalId string = agents.identity.principalId
