import type { LlmClient } from "../llm/types.js";
import { surveyReviewQaPrompt } from "./prompts/surveyReviewQa.js";
import { documentQaSchema } from "./schemas/documentQaSchema.js";
import { DocumentRetrievalService } from "./documentRetrievalService.js";
import type { DocumentChunk, QaRequest, QaResponse } from "./types.js";

export class DocumentQaService {
  constructor(
    private readonly llmClient: LlmClient,
    private readonly retrievalService = new DocumentRetrievalService(),
  ) {}

  async answerQuestion(request: QaRequest, chunks: DocumentChunk[]): Promise<QaResponse> {
    const startedAt = Date.now();
    const retrieved = this.retrievalService.retrieveProjectContext(request.question, chunks, {
      topK: request.topK ?? 8,
      documentIds: request.documentIds,
    });

    if (retrieved.length === 0) {
      return {
        answer: "I do not have enough information in the uploaded documents.",
        citations: [],
        warnings: ["No matching document context was retrieved."],
        modelName: "rule-based-empty-context",
        latencyMs: Date.now() - startedAt,
      };
    }

    const prompt = [
      `Question: ${request.question}`,
      "Retrieved context:",
      ...retrieved.map(
        (chunk) => `- chunkId=${chunk.id} pages=${chunk.pageStart}-${chunk.pageEnd} text=${chunk.chunkText}`,
      ),
    ].join("\n");

    const result = await this.llmClient.generateJson({
      systemPrompt: surveyReviewQaPrompt,
      userPrompt: prompt,
      schema: documentQaSchema,
    });

    return {
      answer: result.data.answer,
      citations: result.data.citations
        .map((citation) => retrieved.find((chunk) => chunk.id === citation.chunkId))
        .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk))
        .map((chunk) => ({
          documentId: chunk.documentId,
          documentTitle: chunk.documentTitle ?? null,
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          chunkId: chunk.id,
        })),
      warnings: result.data.warnings,
      modelName: result.modelName,
      latencyMs: Date.now() - startedAt,
    };
  }
}
