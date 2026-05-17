import { randomUUID } from "node:crypto";
import { DocumentChunkingService } from "./documentChunkingService.js";
import { DocumentParsingService } from "./documentParsingService.js";
import type {
  DocumentChunk,
  DocumentPage,
  DocumentProcessingSummary,
  ProjectDocument,
} from "./types.js";
import type { ProjectDocumentRepository } from "./documentRepository.js";

export class DocumentPipelineService {
  constructor(
    private readonly repository: ProjectDocumentRepository,
    private readonly parsingService = new DocumentParsingService(),
    private readonly chunkingService = new DocumentChunkingService(),
  ) {}

  async processDocument(documentId: string): Promise<DocumentProcessingSummary | null> {
    const document = await this.repository.getById(documentId);
    if (!document) {
      return null;
    }

    await this.ensureParsed(document);
    await this.ensureIndexed(documentId);
    return this.buildSummary(documentId);
  }

  async processPendingDocumentsOnce(): Promise<DocumentProcessingSummary[]> {
    const pendingParse = await this.repository.listPendingParseDocuments();
    const pendingIndex = await this.repository.listPendingIndexDocuments();
    const candidateIds = [...pendingParse, ...pendingIndex].map((document) => document.id);
    const uniqueIds = [...new Set(candidateIds)];
    const results: DocumentProcessingSummary[] = [];

    for (const documentId of uniqueIds) {
      const result = await this.processDocument(documentId);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  async getDocumentDetail(documentId: string) {
    const document = await this.repository.getById(documentId);
    if (!document) {
      return null;
    }

    const [pages, chunks, warnings] = await Promise.all([
      this.repository.listPages(documentId),
      this.repository.listChunks(documentId),
      this.repository.getProcessingWarnings(documentId),
    ]);

    return { document, pages, chunks, warnings };
  }

  private async ensureParsed(document: ProjectDocument): Promise<void> {
    if (document.parsedStatus !== "pending") {
      return;
    }

    const sourceText = await this.repository.getSourceText(document.id);
    const parsed = this.parsingService.parseTextPages(this.toPages(sourceText));
    const pages: DocumentPage[] = parsed.pages.map((page) => ({
      id: randomUUID(),
      documentId: document.id,
      pageNumber: page.pageNumber,
      textContent: page.textContent,
      ocrConfidence: page.ocrConfidence,
      parseMethod: page.parseMethod,
      createdAt: new Date().toISOString(),
    }));

    await this.repository.replacePages(document.id, pages);
    await this.repository.setProcessingWarnings(document.id, parsed.warnings);
    await this.repository.updateStatuses(document.id, {
      parsedStatus: parsed.status,
      indexedStatus: parsed.status === "complete" ? "pending" : document.indexedStatus,
    });
  }

  private async ensureIndexed(documentId: string): Promise<void> {
    const current = await this.repository.getById(documentId);
    if (!current || current.parsedStatus !== "complete" || current.indexedStatus !== "pending") {
      return;
    }

    const pages = await this.repository.listPages(documentId);
    const chunks = this.chunkingService.chunkDocument(documentId, current.documentType, pages, {
      targetTokens: Number(process.env.DOCUMENT_CHUNK_TARGET_TOKENS ?? 1000),
      overlapTokens: Number(process.env.DOCUMENT_CHUNK_OVERLAP_TOKENS ?? 150),
    });

    await this.repository.replaceChunks(documentId, chunks);
    await this.repository.updateStatuses(documentId, { indexedStatus: "complete" });
  }

  private async buildSummary(documentId: string): Promise<DocumentProcessingSummary> {
    const [document, pages, chunks, warnings] = await Promise.all([
      this.repository.getById(documentId),
      this.repository.listPages(documentId),
      this.repository.listChunks(documentId),
      this.repository.getProcessingWarnings(documentId),
    ]);

    if (!document) {
      throw new Error(`Document ${documentId} disappeared during processing.`);
    }

    return {
      documentId,
      parsedStatus: document.parsedStatus,
      indexedStatus: document.indexedStatus,
      pageCount: pages.length,
      chunkCount: chunks.length,
      warnings,
    };
  }

  private toPages(sourceText: string | null): string[] {
    if (!sourceText?.trim()) {
      return [""];
    }

    const explicitPages = sourceText
      .split(/\f|\n---page---\n/gi)
      .map((part) => part.trim())
      .filter(Boolean);

    return explicitPages.length > 0 ? explicitPages : [sourceText];
  }
}
