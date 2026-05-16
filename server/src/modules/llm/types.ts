import type { z } from "zod";

export interface LlmUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface JsonGenerationResult<T> {
  data: T;
  modelName: string;
  latencyMs: number;
  usage?: LlmUsage;
  rawText: string;
}

export interface TextGenerationResult {
  text: string;
  modelName: string;
  latencyMs: number;
  usage?: LlmUsage;
}

export interface LlmClient {
  generateJson<TSchema extends z.ZodTypeAny>(args: {
    systemPrompt: string;
    userPrompt: string;
    schema: TSchema;
    maxTokens?: number;
    temperature?: number;
  }): Promise<JsonGenerationResult<z.infer<TSchema>>>;
  generateText(args: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<TextGenerationResult>;
}

export interface LlmClientConfig {
  provider: "mock" | "vllm" | "openai";
  baseUrl?: string;
  apiKey?: string;
  modelName: string;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
}
