export type LlmProvider = "mock" | "runpod" | "openai" | "local";
export type LlmMessageRole = "system" | "user" | "assistant";
export type LlmResponseFormat = "text" | "json";

export interface LlmChatMessage {
  role: LlmMessageRole;
  content: string;
}

export interface LlmChatInput {
  system?: string;
  messages: LlmChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: LlmResponseFormat;
  metadata?: Record<string, unknown>;
}

export interface LlmChatResult {
  text: string;
  json?: unknown;
  modelName: string;
  provider: LlmProvider;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  raw?: unknown;
}

export interface LlmClient {
  chat(input: LlmChatInput): Promise<LlmChatResult>;
}

export interface LlmRuntimeConfig {
  provider: LlmProvider;
  defaultTemperature: number;
  defaultMaxTokens: number;
  timeoutMs: number;
  runpod: {
    baseUrl: string | null;
    apiKey: string | null;
    modelName: string;
  };
  openai: {
    baseUrl: string | null;
    apiKey: string | null;
    modelName: string;
  };
  local: {
    baseUrl: string;
    apiKey: string | null;
    modelName: string;
  };
}

export interface LlmProviderStatus {
  llmProvider: LlmProvider;
  modelName: string;
  baseUrlConfigured: boolean;
  embeddingProvider: string;
  aiExtractionEnabled: boolean;
  ragQaEnabled: boolean;
}
