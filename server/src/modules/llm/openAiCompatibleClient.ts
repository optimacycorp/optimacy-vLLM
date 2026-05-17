import type { LlmChatInput, LlmChatResult, LlmClient, LlmProvider } from "./types.js";

interface OpenAiCompatibleClientOptions {
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string | null;
  modelName: string;
  timeoutMs: number;
  defaultTemperature: number;
  defaultMaxTokens: number;
}

interface OpenAiChatResponse {
  model?: string;
  choices: Array<{
    message: {
      content: string | Array<{ type: string; text?: string }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export class OpenAiCompatibleClient implements LlmClient {
  constructor(private readonly options: OpenAiCompatibleClientOptions) {}

  async chat(input: LlmChatInput): Promise<LlmChatResult> {
    const startedAt = Date.now();
    const response = await fetch(`${this.options.baseUrl}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(this.options.timeoutMs),
      headers: {
        "Content-Type": "application/json",
        ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.options.modelName,
        messages: input.system
          ? [{ role: "system", content: input.system }, ...input.messages]
          : input.messages,
        temperature: input.temperature ?? this.options.defaultTemperature,
        max_tokens: input.maxTokens ?? this.options.defaultMaxTokens,
        response_format: input.responseFormat === "json" ? { type: "json_object" } : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`${this.options.provider} request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as OpenAiChatResponse;
    const content = payload.choices[0]?.message?.content;
    const text =
      typeof content === "string"
        ? content
        : (content ?? [])
            .map((part) => part.text ?? "")
            .join("")
            .trim();

    if (!text) {
      throw new Error(`${this.options.provider} response did not contain message content`);
    }

    return {
      text,
      json: this.tryParseJson(text),
      modelName: payload.model ?? this.options.modelName,
      provider: this.options.provider,
      latencyMs: Date.now() - startedAt,
      promptTokens: payload.usage?.prompt_tokens,
      completionTokens: payload.usage?.completion_tokens,
      raw: payload,
    };
  }

  private tryParseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }
}
