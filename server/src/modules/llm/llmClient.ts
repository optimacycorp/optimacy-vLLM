import { MockLlmClient } from "./mockLlmClient.js";
import type { LlmClient, LlmClientConfig } from "./types.js";
import { VllmClient } from "./vllmClient.js";

export function createLlmClient(config: LlmClientConfig): LlmClient {
  if (config.provider === "mock") {
    return new MockLlmClient(config.modelName);
  }

  if (config.provider === "vllm" || config.provider === "openai") {
    return new VllmClient(config);
  }

  throw new Error(`Unsupported LLM provider: ${String(config.provider)}`);
}
