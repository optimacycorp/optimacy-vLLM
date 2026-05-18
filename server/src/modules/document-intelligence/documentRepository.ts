import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  DocumentAiFindingRecord,
  DocumentChunk,
  DocumentExtractionRecord,
  DocumentPage,
  DocumentQaRunRecord,
  IngestionInput,
  ProcessingStatus,
  ProjectDocument,
} from "./types.js";
import { DocumentIngestionService } from "./documentIngestionService.js";

interface DocumentStoreShape {
  documents: ProjectDocument[];
  pages: DocumentPage[];
  chunks: DocumentChunk[];
  extractions: DocumentExtractionRecord[];
  findings: DocumentAiFindingRecord[];
  qaRuns: DocumentQaRunRecord[];
  sourceTexts: Record<string, string>;
  processingWarnings: Record<string, string[]>;
}

export interface ProjectDocumentExport {
  documents: ProjectDocument[];
  pages: DocumentPage[];
  chunks: DocumentChunk[];
  extractions: DocumentExtractionRecord[];
  findings: DocumentAiFindingRecord[];
  qaRuns: DocumentQaRunRecord[];
  sourceTexts: Record<string, string>;
  processingWarnings: Record<string, string[]>;
}

interface UpdateDocumentStatusesInput {
  parsedStatus?: ProcessingStatus;
  extractionStatus?: ProcessingStatus;
  indexedStatus?: ProcessingStatus;
}

interface CreateProjectDocumentInput extends IngestionInput {
  source?: string | null;
  recordingDate?: string | null;
  receptionNumber?: string | null;
  bookPage?: string | null;
}

export interface ProjectDocumentRepository {
  create(input: CreateProjectDocumentInput): Promise<ProjectDocument>;
  listByProjectId(projectId: string): Promise<ProjectDocument[]>;
  getById(documentId: string): Promise<ProjectDocument | null>;
  updateStatuses(documentId: string, input: UpdateDocumentStatusesInput): Promise<ProjectDocument | null>;
  setSourceText(documentId: string, text: string): Promise<void>;
  getSourceText(documentId: string): Promise<string | null>;
  replacePages(documentId: string, pages: DocumentPage[]): Promise<void>;
  listPages(documentId: string): Promise<DocumentPage[]>;
  replaceChunks(documentId: string, chunks: DocumentChunk[]): Promise<void>;
  listChunks(documentId: string): Promise<DocumentChunk[]>;
  listChunksByProjectId(projectId: string): Promise<DocumentChunk[]>;
  createExtraction(record: Omit<DocumentExtractionRecord, "id" | "createdAt">): Promise<DocumentExtractionRecord>;
  listExtractionsByDocumentId(documentId: string): Promise<DocumentExtractionRecord[]>;
  listExtractionsByProjectId(projectId: string): Promise<DocumentExtractionRecord[]>;
  replaceFindingsForDocument(documentId: string, findings: DocumentAiFindingRecord[]): Promise<void>;
  listFindingsByDocumentId(documentId: string): Promise<DocumentAiFindingRecord[]>;
  listFindingsByProjectId(projectId: string): Promise<DocumentAiFindingRecord[]>;
  setProcessingWarnings(documentId: string, warnings: string[]): Promise<void>;
  getProcessingWarnings(documentId: string): Promise<string[]>;
  createQaRun(run: Omit<DocumentQaRunRecord, "id" | "createdAt">): Promise<DocumentQaRunRecord>;
  listQaRunsByProjectId(projectId: string): Promise<DocumentQaRunRecord[]>;
  exportProjectData(projectId: string): Promise<ProjectDocumentExport>;
  listPendingParseDocuments(): Promise<ProjectDocument[]>;
  listPendingIndexDocuments(): Promise<ProjectDocument[]>;
}

export class FileProjectDocumentRepository implements ProjectDocumentRepository {
  private readonly ingestionService = new DocumentIngestionService();

  constructor(private readonly storePath: string) {}

  async create(input: CreateProjectDocumentInput): Promise<ProjectDocument> {
    const store = await this.readStore();
    const baseDocument = this.ingestionService.createPendingDocument(input);
    const document: ProjectDocument = {
      ...baseDocument,
      id: randomUUID(),
      source: input.source ?? null,
      recordingDate: input.recordingDate ?? null,
      receptionNumber: input.receptionNumber ?? null,
      bookPage: input.bookPage ?? null,
    };

    store.documents.push(document);
    if (input.firstPageText?.trim()) {
      store.sourceTexts[document.id] = input.firstPageText;
    }
    await this.writeStore(store);
    return document;
  }

  async listByProjectId(projectId: string): Promise<ProjectDocument[]> {
    const store = await this.readStore();
    return store.documents
      .filter((document) => document.projectId === projectId)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }

  async getById(documentId: string): Promise<ProjectDocument | null> {
    const store = await this.readStore();
    return store.documents.find((document) => document.id === documentId) ?? null;
  }

  async updateStatuses(documentId: string, input: UpdateDocumentStatusesInput): Promise<ProjectDocument | null> {
    const store = await this.readStore();
    const document = store.documents.find((entry) => entry.id === documentId);
    if (!document) {
      return null;
    }

    if (input.parsedStatus) {
      document.parsedStatus = input.parsedStatus;
    }
    if (input.extractionStatus) {
      document.extractionStatus = input.extractionStatus;
    }
    if (input.indexedStatus) {
      document.indexedStatus = input.indexedStatus;
    }
    document.updatedAt = new Date().toISOString();

    await this.writeStore(store);
    return document;
  }

  async setSourceText(documentId: string, text: string): Promise<void> {
    const store = await this.readStore();
    store.sourceTexts[documentId] = text;
    await this.writeStore(store);
  }

  async getSourceText(documentId: string): Promise<string | null> {
    const store = await this.readStore();
    return store.sourceTexts[documentId] ?? null;
  }

  async replacePages(documentId: string, pages: DocumentPage[]): Promise<void> {
    const store = await this.readStore();
    store.pages = store.pages.filter((page) => page.documentId !== documentId).concat(pages);
    await this.writeStore(store);
  }

  async listPages(documentId: string): Promise<DocumentPage[]> {
    const store = await this.readStore();
    return store.pages
      .filter((page) => page.documentId === documentId)
      .sort((a, b) => a.pageNumber - b.pageNumber);
  }

  async replaceChunks(documentId: string, chunks: DocumentChunk[]): Promise<void> {
    const store = await this.readStore();
    store.chunks = store.chunks.filter((chunk) => chunk.documentId !== documentId).concat(chunks);
    await this.writeStore(store);
  }

  async listChunks(documentId: string): Promise<DocumentChunk[]> {
    const store = await this.readStore();
    return store.chunks
      .filter((chunk) => chunk.documentId === documentId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  async listChunksByProjectId(projectId: string): Promise<DocumentChunk[]> {
    const store = await this.readStore();
    const documentIds = new Set(store.documents.filter((document) => document.projectId === projectId).map((document) => document.id));
    return store.chunks
      .filter((chunk) => documentIds.has(chunk.documentId))
      .sort((a, b) => a.documentId.localeCompare(b.documentId) || a.chunkIndex - b.chunkIndex);
  }

  async createExtraction(record: Omit<DocumentExtractionRecord, "id" | "createdAt">): Promise<DocumentExtractionRecord> {
    const store = await this.readStore();
    const extraction: DocumentExtractionRecord = {
      ...record,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    store.extractions.push(extraction);
    await this.writeStore(store);
    return extraction;
  }

  async listExtractionsByDocumentId(documentId: string): Promise<DocumentExtractionRecord[]> {
    const store = await this.readStore();
    return store.extractions
      .filter((extraction) => extraction.documentId === documentId)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }

  async listExtractionsByProjectId(projectId: string): Promise<DocumentExtractionRecord[]> {
    const store = await this.readStore();
    const documentIds = new Set(store.documents.filter((document) => document.projectId === projectId).map((document) => document.id));
    return store.extractions
      .filter((extraction) => documentIds.has(extraction.documentId))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }

  async replaceFindingsForDocument(documentId: string, findings: DocumentAiFindingRecord[]): Promise<void> {
    const store = await this.readStore();
    store.findings = store.findings.filter((finding) => finding.documentId !== documentId).concat(findings);
    await this.writeStore(store);
  }

  async listFindingsByDocumentId(documentId: string): Promise<DocumentAiFindingRecord[]> {
    const store = await this.readStore();
    return store.findings
      .filter((finding) => finding.documentId === documentId)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }

  async listFindingsByProjectId(projectId: string): Promise<DocumentAiFindingRecord[]> {
    const store = await this.readStore();
    return store.findings
      .filter((finding) => finding.projectId === projectId)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }

  async setProcessingWarnings(documentId: string, warnings: string[]): Promise<void> {
    const store = await this.readStore();
    store.processingWarnings[documentId] = warnings;
    await this.writeStore(store);
  }

  async getProcessingWarnings(documentId: string): Promise<string[]> {
    const store = await this.readStore();
    return store.processingWarnings[documentId] ?? [];
  }

  async createQaRun(run: Omit<DocumentQaRunRecord, "id" | "createdAt">): Promise<DocumentQaRunRecord> {
    const store = await this.readStore();
    const record: DocumentQaRunRecord = {
      ...run,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    store.qaRuns.push(record);
    await this.writeStore(store);
    return record;
  }

  async listQaRunsByProjectId(projectId: string): Promise<DocumentQaRunRecord[]> {
    const store = await this.readStore();
    return store.qaRuns
      .filter((run) => run.projectId === projectId)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }

  async exportProjectData(projectId: string): Promise<ProjectDocumentExport> {
    const store = await this.readStore();
    const documents = store.documents
      .filter((document) => document.projectId === projectId)
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    const documentIds = new Set(documents.map((document) => document.id));

    const sourceTexts = Object.fromEntries(
      Object.entries(store.sourceTexts).filter(([documentId]) => documentIds.has(documentId)),
    );
    const processingWarnings = Object.fromEntries(
      Object.entries(store.processingWarnings).filter(([documentId]) => documentIds.has(documentId)),
    );

    return {
      documents,
      pages: store.pages.filter((page) => documentIds.has(page.documentId)),
      chunks: store.chunks.filter((chunk) => documentIds.has(chunk.documentId)),
      extractions: store.extractions.filter((extraction) => documentIds.has(extraction.documentId)),
      findings: store.findings.filter((finding) => finding.documentId != null && documentIds.has(finding.documentId)),
      qaRuns: store.qaRuns.filter((run) => run.projectId === projectId),
      sourceTexts,
      processingWarnings,
    };
  }

  async listPendingParseDocuments(): Promise<ProjectDocument[]> {
    const store = await this.readStore();
    return store.documents.filter((document) => document.parsedStatus === "pending");
  }

  async listPendingIndexDocuments(): Promise<ProjectDocument[]> {
    const store = await this.readStore();
    return store.documents.filter((document) => document.parsedStatus === "complete" && document.indexedStatus === "pending");
  }

  private async readStore(): Promise<DocumentStoreShape> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<DocumentStoreShape>;
      return {
        documents: parsed.documents ?? [],
        pages: parsed.pages ?? [],
        chunks: parsed.chunks ?? [],
        extractions: parsed.extractions ?? [],
        findings: parsed.findings ?? [],
        qaRuns: parsed.qaRuns ?? [],
        sourceTexts: parsed.sourceTexts ?? {},
        processingWarnings: parsed.processingWarnings ?? {},
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return { documents: [], pages: [], chunks: [], extractions: [], findings: [], qaRuns: [], sourceTexts: {}, processingWarnings: {} };
      }
      throw error;
    }
  }

  private async writeStore(store: DocumentStoreShape): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(this.storePath, JSON.stringify(store, null, 2), "utf8");
  }
}

export function createProjectDocumentRepository(
  storePath = process.env.DOCUMENT_STORE_PATH ?? path.resolve(process.cwd(), "data", "project-documents.json"),
): ProjectDocumentRepository {
  return new FileProjectDocumentRepository(storePath);
}
