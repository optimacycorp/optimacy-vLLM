import type { z } from "zod";
import type { JsonGenerationResult, LlmClient, TextGenerationResult } from "./types.js";

export class MockLlmClient implements LlmClient {
  constructor(private readonly modelName = "mock-llm") {}

  async generateJson<TSchema extends z.ZodTypeAny>(args: {
    systemPrompt: string;
    userPrompt: string;
    schema: TSchema;
    maxTokens?: number;
    temperature?: number;
  }): Promise<JsonGenerationResult<z.infer<TSchema>>> {
    const startedAt = Date.now();
    const candidate = this.buildMockJson(args.userPrompt);
    const data = args.schema.parse(candidate);

    return {
      data,
      modelName: this.modelName,
      latencyMs: Date.now() - startedAt,
      rawText: JSON.stringify(candidate),
      usage: {
        promptTokens: Math.ceil((args.systemPrompt.length + args.userPrompt.length) / 4),
        completionTokens: Math.ceil(JSON.stringify(candidate).length / 4),
      },
    };
  }

  async generateText(args: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<TextGenerationResult> {
    const startedAt = Date.now();
    return {
      text: `Mock answer grounded in provided context for: ${args.userPrompt.slice(0, 120)}`,
      modelName: this.modelName,
      latencyMs: Date.now() - startedAt,
      usage: {
        promptTokens: Math.ceil((args.systemPrompt.length + args.userPrompt.length) / 4),
        completionTokens: 32,
      },
    };
  }

  private buildMockJson(userPrompt: string): unknown {
    if (/commitment/i.test(userPrompt)) {
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

    if (/easement/i.test(userPrompt)) {
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

    if (/question:/i.test(userPrompt)) {
      return {
        answer: "I do not have enough information in the uploaded documents.",
        warnings: ["Mock QA mode does not synthesize document facts."],
        citations: [],
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
}
