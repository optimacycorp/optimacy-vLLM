import type { LlmChatInput, LlmChatResult, LlmClient } from "./types.js";

export class MockLlmClient implements LlmClient {
  async chat(input: LlmChatInput): Promise<LlmChatResult> {
    const startedAt = Date.now();
    const lastMessage = input.messages.at(-1)?.content ?? "";
    const text =
      input.responseFormat === "json"
        ? JSON.stringify(this.buildMockJson(lastMessage))
        : `Mock answer grounded in provided context for: ${lastMessage.slice(0, 120)}`;

    return {
      text,
      json: input.responseFormat === "json" ? this.tryParseJson(text) : undefined,
      modelName: "mock-llm",
      provider: "mock",
      latencyMs: Date.now() - startedAt,
      promptTokens: Math.ceil((input.system?.length ?? 0 + lastMessage.length) / 4),
      completionTokens: Math.ceil(text.length / 4),
      raw: { mocked: true },
    };
  }

  private buildMockJson(prompt: string): unknown {
    if (/status ok/i.test(prompt)) {
      return { status: "ok" };
    }

    if (/question:/i.test(prompt)) {
      const chunkId = prompt.match(/chunkId=([a-f0-9-]+)/i)?.[1] ?? null;
      const chunkText = prompt.match(/text=(.+)$/im)?.[1]?.trim() ?? null;
      return {
        answer: chunkText
          ? `Mock answer from retrieved context: ${chunkText.slice(0, 180)}`
          : "I do not have enough information in the uploaded documents.",
        warnings: chunkText ? ["Mock QA answer generated from the top retrieved chunk."] : ["Mock QA mode does not synthesize document facts."],
        citations: chunkId ? [{ chunkId, claim: "Mock claim grounded in retrieved context." }] : [],
      };
    }

    if (/commitment/i.test(prompt)) {
      return {
        commitmentNumber: null,
        effectiveDate: null,
        issueDate: null,
        proposedInsured: null,
        estateOrInterest: null,
        vestedOwner: null,
        landDescription: null,
        requirements: [],
        exceptions: [],
        warnings: ["Mock extraction generated without source document review."],
      };
    }

    if (/easement/i.test(prompt)) {
      return {
        documentType: "easement",
        grantor: [],
        grantee: [],
        recordingDate: null,
        receptionNumber: null,
        easementPurpose: null,
        width: null,
        locationDescription: null,
        burdenedProperty: null,
        benefitedProperty: null,
        maintenanceRights: null,
        accessRights: null,
        legalDescription: null,
        surveyRelevance: "low",
        warnings: ["Mock extraction generated without source document review."],
      };
    }

    return {
      documentType: "deed",
      deedType: null,
      grantor: [],
      grantee: [],
      recordingDate: null,
      executionDate: null,
      receptionNumber: null,
      bookPage: null,
      consideration: null,
      legalDescription: null,
      reservations: [],
      exceptions: [],
      warnings: ["Mock extraction generated without source document review."],
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
