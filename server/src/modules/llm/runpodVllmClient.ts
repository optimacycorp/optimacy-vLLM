import { OpenAiCompatibleClient } from "./openAiCompatibleClient.js";
import type { LlmClient, LlmRuntimeConfig } from "./types.js";

export function createRunpodVllmClient(config: LlmRuntimeConfig): LlmClient {
  if (!config.runpod.baseUrl) {
    throw new Error("RUNPOD_VLLM_BASE_URL is required when LLM_PROVIDER=runpod");
  }

  return new OpenAiCompatibleClient({
    provider: "runpod",
    baseUrl: config.runpod.baseUrl,
    apiKey: config.runpod.apiKey,
    modelName: config.runpod.modelName,
    timeoutMs: config.timeoutMs,
    defaultTemperature: config.defaultTemperature,
    defaultMaxTokens: config.defaultMaxTokens,
  });
}
