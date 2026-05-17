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
    const result = await this.llmClient.chat({
      system: titleCommitmentExtractionPrompt,
      messages: [{ role: "user", content: this.buildContextPrompt("title commitment", chunks) }],
      responseFormat: "json",
    });
    const parsed = titleCommitmentSchema.parse(result.json ?? this.parseJsonText(result.text, "title_commitment", result));

    return {
      id: randomUUID(),
      documentId,
      extractionType: "title_commitment",
      modelName: result.modelName,
      schemaVersion: "1.0.0",
      extractedJson: parsed,
      warnings: parsed.warnings,
      confidence: null,
      createdAt: new Date().toISOString(),
    };
  }

  async extractDeed(documentId: string, chunks: DocumentChunk[]): Promise<DocumentExtractionRecord> {
    const result = await this.llmClient.chat({
      system: deedExtractionPrompt,
      messages: [{ role: "user", content: this.buildContextPrompt("deed", chunks) }],
      responseFormat: "json",
    });
    const parsed = deedSchema.parse(result.json ?? this.parseJsonText(result.text, "deed", result));

    return {
      id: randomUUID(),
      documentId,
      extractionType: "deed",
      modelName: result.modelName,
      schemaVersion: "1.0.0",
      extractedJson: parsed,
      warnings: parsed.warnings,
      confidence: null,
      createdAt: new Date().toISOString(),
    };
  }

  async extractEasement(documentId: string, chunks: DocumentChunk[]): Promise<DocumentExtractionRecord> {
    const result = await this.llmClient.chat({
      system: easementExtractionPrompt,
      messages: [{ role: "user", content: this.buildContextPrompt("easement", chunks) }],
      responseFormat: "json",
    });
    const parsed = easementSchema.parse(result.json ?? this.parseJsonText(result.text, "easement", result));

    return {
      id: randomUUID(),
      documentId,
      extractionType: "easement",
      modelName: result.modelName,
      schemaVersion: "1.0.0",
      extractedJson: parsed,
      warnings: parsed.warnings,
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

  private parseJsonText(resultText: string, extractionType: string, result: { provider: string; modelName: string }): unknown {
    try {
      return JSON.parse(resultText);
    } catch (error) {
      console.error("Malformed JSON returned by extraction provider", {
        extractionType,
        provider: result.provider,
        modelName: result.modelName,
        error,
      });
      throw error;
    }
  }
}
