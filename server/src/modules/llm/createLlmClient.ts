import { loadLlmConfig } from "./llmConfig.js";
import { createLocalLlmClient } from "./localLlmClient.js";
import { MockLlmClient } from "./mockLlmClient.js";
import { OpenAiCompatibleClient } from "./openAiCompatibleClient.js";
import { createRunpodVllmClient } from "./runpodVllmClient.js";
import type { LlmClient, LlmRuntimeConfig } from "./types.js";

export function createLlmClient(config: LlmRuntimeConfig = loadLlmConfig()): LlmClient {
  switch (config.provider) {
    case "mock":
      return new MockLlmClient();
    case "runpod":
      return createRunpodVllmClient(config);
    case "local":
      return createLocalLlmClient(config);
    case "openai":
      if (!config.openai.apiKey) {
        throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
      }
      return new OpenAiCompatibleClient({
        provider: "openai",
        baseUrl: config.openai.baseUrl ?? "https://api.openai.com/v1",
        apiKey: config.openai.apiKey,
        modelName: config.openai.modelName,
        timeoutMs: config.timeoutMs,
        defaultTemperature: config.defaultTemperature,
        defaultMaxTokens: config.defaultMaxTokens,
      });
  }
}
