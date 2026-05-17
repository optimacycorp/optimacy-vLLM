import { OpenAiCompatibleClient } from "./openAiCompatibleClient.js";
import type { LlmClient, LlmRuntimeConfig } from "./types.js";

export function createLocalLlmClient(config: LlmRuntimeConfig): LlmClient {
  return new OpenAiCompatibleClient({
    provider: "local",
    baseUrl: config.local.baseUrl,
    apiKey: config.local.apiKey,
    modelName: config.local.modelName,
    timeoutMs: config.timeoutMs,
    defaultTemperature: config.defaultTemperature,
    defaultMaxTokens: config.defaultMaxTokens,
  });
}
