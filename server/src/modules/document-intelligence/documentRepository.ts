import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadDocumentBackendConfig } from "./documentBackendConfig.js";
import { SupabaseRestClient } from "./supabaseClient.js";
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
    return store.pages.filter((page) => page.documentId === documentId).sort((a, b) => a.pageNumber - b.pageNumber);
  }

  async replaceChunks(documentId: string, chunks: DocumentChunk[]): Promise<void> {
    const store = await this.readStore();
    store.chunks = store.chunks.filter((chunk) => chunk.documentId !== documentId).concat(chunks);
    await this.writeStore(store);
  }

  async listChunks(documentId: string): Promise<DocumentChunk[]> {
    const store = await this.readStore();
    return store.chunks.filter((chunk) => chunk.documentId === documentId).sort((a, b) => a.chunkIndex - b.chunkIndex);
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
    const extraction: DocumentExtractionRecord = { ...record, id: randomUUID(), createdAt: new Date().toISOString() };
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
    return store.findings.filter((finding) => finding.projectId === projectId).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
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
    const record: DocumentQaRunRecord = { ...run, id: randomUUID(), createdAt: new Date().toISOString() };
    store.qaRuns.push(record);
    await this.writeStore(store);
    return record;
  }

  async listQaRunsByProjectId(projectId: string): Promise<DocumentQaRunRecord[]> {
    const store = await this.readStore();
    return store.qaRuns.filter((run) => run.projectId === projectId).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }

  async exportProjectData(projectId: string): Promise<ProjectDocumentExport> {
    const store = await this.readStore();
    const documents = store.documents.filter((document) => document.projectId === projectId).sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    const documentIds = new Set(documents.map((document) => document.id));

    return {
      documents,
      pages: store.pages.filter((page) => documentIds.has(page.documentId)),
      chunks: store.chunks.filter((chunk) => documentIds.has(chunk.documentId)),
      extractions: store.extractions.filter((extraction) => documentIds.has(extraction.documentId)),
      findings: store.findings.filter((finding) => finding.documentId != null && documentIds.has(finding.documentId)),
      qaRuns: store.qaRuns.filter((run) => run.projectId === projectId),
      sourceTexts: Object.fromEntries(Object.entries(store.sourceTexts).filter(([documentId]) => documentIds.has(documentId))),
      processingWarnings: Object.fromEntries(
        Object.entries(store.processingWarnings).filter(([documentId]) => documentIds.has(documentId)),
      ),
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

class SupabaseProjectDocumentRepository implements ProjectDocumentRepository {
  private readonly ingestionService = new DocumentIngestionService();

  constructor(private readonly client: SupabaseRestClient) {}

  async create(input: CreateProjectDocumentInput): Promise<ProjectDocument> {
    const baseDocument = this.ingestionService.createPendingDocument(input);
    const payload = {
      id: baseDocument.id,
      project_id: input.projectId,
      storage_path: baseDocument.storagePath,
      original_filename: input.originalFilename,
      document_type: baseDocument.documentType,
      title: input.title ?? null,
      source: input.source ?? null,
      recording_date: input.recordingDate ?? null,
      reception_number: input.receptionNumber ?? null,
      book_page: input.bookPage ?? null,
      parsed_status: baseDocument.parsedStatus,
      extraction_status: baseDocument.extractionStatus,
      indexed_status: baseDocument.indexedStatus,
    };

    const rows = await this.client.from<Array<Record<string, unknown>>>("project_documents", {
      method: "POST",
      body: payload,
    });
    return this.mapDocumentRow(rows[0] ?? payload);
  }

  async listByProjectId(projectId: string): Promise<ProjectDocument[]> {
    const rows = await this.client.from<Array<Record<string, unknown>>>("project_documents", {
      query: { select: "*", project_id: `eq.${projectId}`, order: "created_at.desc" },
    });
    return rows.map((row) => this.mapDocumentRow(row));
  }

  async getById(documentId: string): Promise<ProjectDocument | null> {
    const rows = await this.client.from<Array<Record<string, unknown>>>("project_documents", {
      query: { select: "*", id: `eq.${documentId}` },
    });
    return rows[0] ? this.mapDocumentRow(rows[0]) : null;
  }

  async updateStatuses(documentId: string, input: UpdateDocumentStatusesInput): Promise<ProjectDocument | null> {
    const rows = await this.client.from<Array<Record<string, unknown>>>("project_documents", {
      method: "PATCH",
      query: { id: `eq.${documentId}` },
      body: {
        parsed_status: input.parsedStatus,
        extraction_status: input.extractionStatus,
        indexed_status: input.indexedStatus,
        updated_at: new Date().toISOString(),
      },
    });
    return rows[0] ? this.mapDocumentRow(rows[0]) : null;
  }

  async setSourceText(): Promise<void> {}
  async getSourceText(): Promise<string | null> {
    return null;
  }

  async replacePages(documentId: string, pages: DocumentPage[]): Promise<void> {
    await this.client.from("document_pages", { method: "DELETE", query: { document_id: `eq.${documentId}` } });
    if (pages.length === 0) {
      return;
    }
    await this.client.from("document_pages", {
      method: "POST",
      body: pages.map((page) => ({
        id: page.id,
        document_id: page.documentId,
        page_number: page.pageNumber,
        text_content: page.textContent,
        ocr_confidence: page.ocrConfidence,
        parse_method: page.parseMethod,
      })),
    });
  }

  async listPages(documentId: string): Promise<DocumentPage[]> {
    const rows = await this.client.from<Array<Record<string, unknown>>>("document_pages", {
      query: { select: "*", document_id: `eq.${documentId}`, order: "page_number.asc" },
    });
    return rows.map((row) => this.mapPageRow(row));
  }

  async replaceChunks(documentId: string, chunks: DocumentChunk[]): Promise<void> {
    await this.client.from("document_chunks", { method: "DELETE", query: { document_id: `eq.${documentId}` } });
    if (chunks.length === 0) {
      return;
    }
    await this.client.from("document_chunks", {
      method: "POST",
      body: chunks.map((chunk) => ({
        id: chunk.id,
        document_id: chunk.documentId,
        page_start: chunk.pageStart,
        page_end: chunk.pageEnd,
        chunk_index: chunk.chunkIndex,
        chunk_text: chunk.chunkText,
        token_count: chunk.tokenCount,
        heading: chunk.heading ?? null,
        section_label: chunk.sectionLabel ?? null,
      })),
    });
  }

  async listChunks(documentId: string): Promise<DocumentChunk[]> {
    const rows = await this.client.from<Array<Record<string, unknown>>>("document_chunks", {
      query: { select: "*", document_id: `eq.${documentId}`, order: "chunk_index.asc" },
    });
    return rows.map((row) => this.mapChunkRow(row));
  }

  async listChunksByProjectId(projectId: string): Promise<DocumentChunk[]> {
    const documents = await this.listByProjectId(projectId);
    const all = await Promise.all(documents.map((document) => this.listChunks(document.id)));
    return all.flat();
  }

  async createExtraction(record: Omit<DocumentExtractionRecord, "id" | "createdAt">): Promise<DocumentExtractionRecord> {
    const payload = {
      document_id: record.documentId,
      extraction_type: record.extractionType,
      model_name: record.modelName,
      schema_version: record.schemaVersion,
      extracted_json: record.extractedJson,
      confidence: record.confidence ?? null,
      warnings: record.warnings ?? null,
    };
    const rows = await this.client.from<Array<Record<string, unknown>>>("document_extractions", { method: "POST", body: payload });
    return this.mapExtractionRow(rows[0] ?? payload);
  }

  async listExtractionsByDocumentId(documentId: string): Promise<DocumentExtractionRecord[]> {
    const rows = await this.client.from<Array<Record<string, unknown>>>("document_extractions", {
      query: { select: "*", document_id: `eq.${documentId}`, order: "created_at.desc" },
    });
    return rows.map((row) => this.mapExtractionRow(row));
  }

  async listExtractionsByProjectId(projectId: string): Promise<DocumentExtractionRecord[]> {
    const documents = await this.listByProjectId(projectId);
    const all = await Promise.all(documents.map((document) => this.listExtractionsByDocumentId(document.id)));
    return all.flat();
  }

  async replaceFindingsForDocument(documentId: string, findings: DocumentAiFindingRecord[]): Promise<void> {
    await this.client.from("document_ai_findings", { method: "DELETE", query: { document_id: `eq.${documentId}` } });
    if (findings.length === 0) {
      return;
    }
    await this.client.from("document_ai_findings", {
      method: "POST",
      body: findings.map((finding) => ({
        id: finding.id,
        project_id: finding.projectId,
        document_id: finding.documentId,
        finding_type: finding.findingType,
        severity: finding.severity,
        title: finding.title,
        explanation: finding.explanation,
        supporting_chunk_ids: finding.supportingChunkIds,
        status: finding.status,
      })),
    });
  }

  async listFindingsByDocumentId(documentId: string): Promise<DocumentAiFindingRecord[]> {
    const rows = await this.client.from<Array<Record<string, unknown>>>("document_ai_findings", {
      query: { select: "*", document_id: `eq.${documentId}`, order: "created_at.desc" },
    });
    return rows.map((row) => this.mapFindingRow(row));
  }

  async listFindingsByProjectId(projectId: string): Promise<DocumentAiFindingRecord[]> {
    const rows = await this.client.from<Array<Record<string, unknown>>>("document_ai_findings", {
      query: { select: "*", project_id: `eq.${projectId}`, order: "created_at.desc" },
    });
    return rows.map((row) => this.mapFindingRow(row));
  }

  async setProcessingWarnings(): Promise<void> {}
  async getProcessingWarnings(): Promise<string[]> {
    return [];
  }

  async createQaRun(run: Omit<DocumentQaRunRecord, "id" | "createdAt">): Promise<DocumentQaRunRecord> {
    const payload = {
      project_id: run.projectId,
      question: run.question,
      answer: run.answer,
      cited_chunk_ids: run.citedChunkIds,
      model_name: run.modelName,
      retrieval_k: run.retrievalK,
      prompt_tokens: run.promptTokens ?? null,
      completion_tokens: run.completionTokens ?? null,
      latency_ms: run.latencyMs ?? null,
    };
    const rows = await this.client.from<Array<Record<string, unknown>>>("document_qa_runs", { method: "POST", body: payload });
    return this.mapQaRunRow(rows[0] ?? payload);
  }

  async listQaRunsByProjectId(projectId: string): Promise<DocumentQaRunRecord[]> {
    const rows = await this.client.from<Array<Record<string, unknown>>>("document_qa_runs", {
      query: { select: "*", project_id: `eq.${projectId}`, order: "created_at.desc" },
    });
    return rows.map((row) => this.mapQaRunRow(row));
  }

  async exportProjectData(projectId: string): Promise<ProjectDocumentExport> {
    const documents = await this.listByProjectId(projectId);
    const pages = (await Promise.all(documents.map((document) => this.listPages(document.id)))).flat();
    const chunks = (await Promise.all(documents.map((document) => this.listChunks(document.id)))).flat();
    const extractions = (await Promise.all(documents.map((document) => this.listExtractionsByDocumentId(document.id)))).flat();
    const findings = await this.listFindingsByProjectId(projectId);
    const qaRuns = await this.listQaRunsByProjectId(projectId);
    return {
      documents,
      pages,
      chunks,
      extractions,
      findings,
      qaRuns,
      sourceTexts: {},
      processingWarnings: {},
    };
  }

  async listPendingParseDocuments(): Promise<ProjectDocument[]> {
    const rows = await this.client.from<Array<Record<string, unknown>>>("project_documents", {
      query: { select: "*", parsed_status: "eq.pending" },
    });
    return rows.map((row) => this.mapDocumentRow(row));
  }

  async listPendingIndexDocuments(): Promise<ProjectDocument[]> {
    const rows = await this.client.from<Array<Record<string, unknown>>>("project_documents", {
      query: { select: "*", parsed_status: "eq.complete", indexed_status: "eq.pending" },
    });
    return rows.map((row) => this.mapDocumentRow(row));
  }

  private mapDocumentRow(row: Record<string, unknown>): ProjectDocument {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      storagePath: String(row.storage_path),
      originalFilename: String(row.original_filename),
      documentType: String(row.document_type ?? "unknown") as ProjectDocument["documentType"],
      title: (row.title as string | null | undefined) ?? null,
      source: (row.source as string | null | undefined) ?? null,
      recordingDate: (row.recording_date as string | null | undefined) ?? null,
      receptionNumber: (row.reception_number as string | null | undefined) ?? null,
      bookPage: (row.book_page as string | null | undefined) ?? null,
      parsedStatus: String(row.parsed_status ?? "pending") as ProcessingStatus,
      extractionStatus: String(row.extraction_status ?? "pending") as ProcessingStatus,
      indexedStatus: String(row.indexed_status ?? "pending") as ProcessingStatus,
      createdAt: (row.created_at as string | undefined) ?? undefined,
      updatedAt: (row.updated_at as string | undefined) ?? undefined,
    };
  }

  private mapPageRow(row: Record<string, unknown>): DocumentPage {
    return {
      id: String(row.id),
      documentId: String(row.document_id),
      pageNumber: Number(row.page_number),
      textContent: (row.text_content as string | null | undefined) ?? null,
      ocrConfidence: (row.ocr_confidence as number | null | undefined) ?? null,
      parseMethod: String(row.parse_method ?? "text") as DocumentPage["parseMethod"],
      createdAt: (row.created_at as string | undefined) ?? undefined,
    };
  }

  private mapChunkRow(row: Record<string, unknown>): DocumentChunk {
    return {
      id: String(row.id),
      documentId: String(row.document_id),
      pageStart: (row.page_start as number | null | undefined) ?? null,
      pageEnd: (row.page_end as number | null | undefined) ?? null,
      chunkIndex: Number(row.chunk_index),
      chunkText: String(row.chunk_text ?? ""),
      tokenCount: (row.token_count as number | null | undefined) ?? null,
      heading: (row.heading as string | null | undefined) ?? null,
      sectionLabel: (row.section_label as string | null | undefined) ?? null,
      createdAt: (row.created_at as string | undefined) ?? undefined,
    };
  }

  private mapExtractionRow(row: Record<string, unknown>): DocumentExtractionRecord {
    return {
      id: String(row.id ?? randomUUID()),
      documentId: String(row.document_id),
      extractionType: String(row.extraction_type),
      modelName: String(row.model_name),
      schemaVersion: String(row.schema_version),
      extractedJson: row.extracted_json,
      confidence: (row.confidence as number | null | undefined) ?? null,
      warnings: row.warnings,
      createdAt: (row.created_at as string | undefined) ?? undefined,
    };
  }

  private mapFindingRow(row: Record<string, unknown>): DocumentAiFindingRecord {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      documentId: (row.document_id as string | null | undefined) ?? null,
      findingType: String(row.finding_type),
      severity: String(row.severity) as DocumentAiFindingRecord["severity"],
      title: String(row.title),
      explanation: String(row.explanation),
      supportingChunkIds: ((row.supporting_chunk_ids as string[] | null | undefined) ?? []) as string[],
      status: String(row.status ?? "open") as DocumentAiFindingRecord["status"],
      createdAt: (row.created_at as string | undefined) ?? undefined,
    };
  }

  private mapQaRunRow(row: Record<string, unknown>): DocumentQaRunRecord {
    return {
      id: String(row.id ?? randomUUID()),
      projectId: String(row.project_id),
      question: String(row.question),
      answer: String(row.answer),
      citedChunkIds: ((row.cited_chunk_ids as string[] | null | undefined) ?? []) as string[],
      modelName: String(row.model_name),
      retrievalK: Number(row.retrieval_k),
      promptTokens: (row.prompt_tokens as number | null | undefined) ?? null,
      completionTokens: (row.completion_tokens as number | null | undefined) ?? null,
      latencyMs: (row.latency_ms as number | null | undefined) ?? null,
      createdAt: (row.created_at as string | undefined) ?? undefined,
    };
  }
}

export function createProjectDocumentRepository(storePathOverride?: string): ProjectDocumentRepository {
  const config = loadDocumentBackendConfig();
  if (config.provider === "supabase") {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when DOCUMENT_BACKEND_PROVIDER=supabase");
    }
    return new SupabaseProjectDocumentRepository(new SupabaseRestClient(config.supabaseUrl, config.supabaseServiceRoleKey));
  }

  return new FileProjectDocumentRepository(storePathOverride ?? config.storePath);
}
