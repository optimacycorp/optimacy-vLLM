import { DocumentExtractionService } from "./documentExtractionService.js";
import type { ProjectDocumentRepository } from "./documentRepository.js";
import type { DocumentExtractionRecord } from "./types.js";
import type { LlmClient } from "../llm/types.js";

export class ProjectExtractionService {
  private readonly extractionService: DocumentExtractionService;

  constructor(
    private readonly repository: ProjectDocumentRepository,
    llmClient: LlmClient,
    extractionService = new DocumentExtractionService(llmClient),
  ) {
    this.extractionService = extractionService;
  }

  async extractDocument(documentId: string): Promise<DocumentExtractionRecord | null> {
    const document = await this.repository.getById(documentId);
    if (!document) {
      return null;
    }

    const chunks = await this.repository.listChunks(documentId);
    if (chunks.length === 0) {
      throw new Error("Document has no indexed chunks. Parse and index the document before extraction.");
    }

    let extraction: DocumentExtractionRecord | null = null;
    if (document.documentType === "title_commitment") {
      extraction = await this.extractionService.extractTitleCommitment(documentId, chunks);
    } else if (document.documentType === "deed") {
      extraction = await this.extractionService.extractDeed(documentId, chunks);
    } else if (document.documentType === "easement") {
      extraction = await this.extractionService.extractEasement(documentId, chunks);
    } else {
      throw new Error(`Structured extraction is not configured for document type ${document.documentType}.`);
    }

    const saved = await this.repository.createExtraction({
      documentId: extraction.documentId,
      extractionType: extraction.extractionType,
      modelName: extraction.modelName,
      schemaVersion: extraction.schemaVersion,
      extractedJson: extraction.extractedJson,
      confidence: extraction.confidence ?? null,
      warnings: extraction.warnings,
    });

    await this.repository.updateStatuses(documentId, { extractionStatus: "complete" });
    return saved;
  }
}
