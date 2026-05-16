import type { z } from "zod";
import type { JsonGenerationResult, LlmClient, LlmClientConfig, TextGenerationResult } from "./types.js";

interface OpenAiChatResponse {
  choices: Array<{
    message: {
      content: string | Array<{ type: string; text?: string }>;
    };
  }>;
}

export class VllmClient implements LlmClient {
  constructor(private readonly config: LlmClientConfig) {}

  async generateJson<TSchema extends z.ZodTypeAny>(args: {
    systemPrompt: string;
    userPrompt: string;
    schema: TSchema;
    maxTokens?: number;
    temperature?: number;
  }): Promise<JsonGenerationResult<z.infer<TSchema>>> {
    const startedAt = Date.now();
    let responseText = await this.chat(args.systemPrompt, `${args.userPrompt}\n\nReturn JSON only.`, args.maxTokens, args.temperature);

    try {
      const parsed = args.schema.parse(JSON.parse(responseText));
      return { data: parsed, modelName: this.config.modelName, latencyMs: Date.now() - startedAt, rawText: responseText };
    } catch {
      responseText = await this.chat(
        args.systemPrompt,
        `${args.userPrompt}\n\nYour previous reply was malformed JSON. Repair it and return valid JSON only.`,
        args.maxTokens,
        args.temperature,
      );
      const parsed = args.schema.parse(JSON.parse(responseText));
      return { data: parsed, modelName: this.config.modelName, latencyMs: Date.now() - startedAt, rawText: responseText };
    }
  }

  async generateText(args: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<TextGenerationResult> {
    const startedAt = Date.now();
    const text = await this.chat(args.systemPrompt, args.userPrompt, args.maxTokens, args.temperature);
    return { text, modelName: this.config.modelName, latencyMs: Date.now() - startedAt };
  }

  private async chat(systemPrompt: string, userPrompt: string, maxTokens?: number, temperature?: number): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.config.apiKey ? `Bearer ${this.config.apiKey}` : "",
      },
      body: JSON.stringify({
        model: this.config.modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: temperature ?? this.config.temperature ?? 0.1,
        max_tokens: maxTokens ?? this.config.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`vLLM request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as OpenAiChatResponse;
    const content = payload.choices[0]?.message?.content;
    if (typeof content === "string") {
      return content;
    }

    const joined = (content ?? []).map((part) => part.text ?? "").join("").trim();
    if (!joined) {
      throw new Error("vLLM response did not contain message content");
    }

    return joined;
  }
}
