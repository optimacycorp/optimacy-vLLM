import { randomUUID } from "node:crypto";
import type { LlmClient } from "../llm/types.js";
import { deedExtractionPrompt } from "./prompts/deedExtraction.js";
import { easementExtractionPrompt } from "./prompts/easementExtraction.js";
import { titleCommitmentExtractionPrompt } from "./prompts/titleCommitmentExtraction.js";
import { deedSchema } from "./schemas/deedSchema.js";
import { easementSchema } from "./schemas/easementSchema.js";
import { titleCommitmentSchema } from "./schemas/titleCommitmentSchema.js";
import type { DocumentChunk, DocumentExtractionRecord } from "./types.js";

export class DocumentExtractionService {
  constructor(private readonly llmClient: LlmClient) {}

  async extractTitleCommitment(documentId: string, chunks: DocumentChunk[]): Promise<DocumentExtractionRecord> {
    const result = await this.llmClient.generateJson({
      systemPrompt: titleCommitmentExtractionPrompt,
      userPrompt: this.buildContextPrompt("title commitment", chunks),
      schema: titleCommitmentSchema,
    });

    return {
      id: randomUUID(),
      documentId,
      extractionType: "title_commitment",
      modelName: result.modelName,
      schemaVersion: "1.0.0",
      extractedJson: result.data,
      warnings: result.data.warnings,
      confidence: null,
      createdAt: new Date().toISOString(),
    };
  }

  async extractDeed(documentId: string, chunks: DocumentChunk[]): Promise<DocumentExtractionRecord> {
    const result = await this.llmClient.generateJson({
      systemPrompt: deedExtractionPrompt,
      userPrompt: this.buildContextPrompt("deed", chunks),
      schema: deedSchema,
    });

    return {
      id: randomUUID(),
      documentId,
      extractionType: "deed",
      modelName: result.modelName,
      schemaVersion: "1.0.0",
      extractedJson: result.data,
      warnings: result.data.warnings,
      confidence: null,
      createdAt: new Date().toISOString(),
    };
  }

  async extractEasement(documentId: string, chunks: DocumentChunk[]): Promise<DocumentExtractionRecord> {
    const result = await this.llmClient.generateJson({
      systemPrompt: easementExtractionPrompt,
      userPrompt: this.buildContextPrompt("easement", chunks),
      schema: easementSchema,
    });

    return {
      id: randomUUID(),
      documentId,
      extractionType: "easement",
      modelName: result.modelName,
      schemaVersion: "1.0.0",
      extractedJson: result.data,
      warnings: result.data.warnings,
      confidence: null,
      createdAt: new Date().toISOString(),
    };
  }

  private buildContextPrompt(label: string, chunks: DocumentChunk[]): string {
    const serializedChunks = chunks
      .map((chunk) => `[chunk:${chunk.id}] pages ${chunk.pageStart}-${chunk.pageEnd}\n${chunk.chunkText}`)
      .join("\n\n");

    return `Extract structured ${label} data from the following document context:\n\n${serializedChunks}`;
  }
}
