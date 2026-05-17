import type { LlmProvider, LlmProviderStatus, LlmRuntimeConfig } from "./types.js";

const defaultModels: Record<LlmProvider, string> = {
  mock: "mock-llm",
  runpod: "Qwen/Qwen2.5-7B-Instruct",
  openai: "gpt-4o-mini",
  local: "local-dev-model",
};

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function loadLlmConfig(env = process.env): LlmRuntimeConfig {
  const provider = (env.LLM_PROVIDER ?? "mock") as LlmProvider;

  return {
    provider,
    defaultTemperature: parseNumber(env.LLM_DEFAULT_TEMPERATURE, 0.1),
    defaultMaxTokens: parseNumber(env.LLM_DEFAULT_MAX_TOKENS, 1200),
    timeoutMs: parseNumber(env.LLM_TIMEOUT_MS, 120000),
    runpod: {
      baseUrl: env.RUNPOD_VLLM_BASE_URL ?? null,
      apiKey: env.RUNPOD_VLLM_API_KEY ?? null,
      modelName: env.RUNPOD_VLLM_MODEL_NAME ?? defaultModels.runpod,
    },
    openai: {
      baseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      apiKey: env.OPENAI_API_KEY ?? null,
      modelName: env.OPENAI_MODEL_NAME ?? defaultModels.openai,
    },
    local: {
      baseUrl: env.LOCAL_LLM_BASE_URL ?? "http://localhost:8000/v1",
      apiKey: env.LOCAL_LLM_API_KEY ?? "local-dev-key",
      modelName: env.LOCAL_LLM_MODEL_NAME ?? defaultModels.local,
    },
  };
}

export function getLlmProviderStatus(env = process.env): LlmProviderStatus {
  const config = loadLlmConfig(env);
  const selectedConfig =
    config.provider === "runpod"
      ? config.runpod
      : config.provider === "openai"
        ? config.openai
        : config.provider === "local"
          ? config.local
          : { baseUrl: null, apiKey: null, modelName: defaultModels.mock };

  return {
    llmProvider: config.provider,
    modelName: selectedConfig.modelName,
    baseUrlConfigured: Boolean(selectedConfig.baseUrl),
    embeddingProvider: env.EMBEDDING_PROVIDER ?? "mock",
    aiExtractionEnabled: parseBoolean(env.ENABLE_AI_EXTRACTION, false),
    ragQaEnabled: parseBoolean(env.ENABLE_RAG_QA, true),
  };
}
