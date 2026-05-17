import type { z } from "zod";

export const documentTypes = [
  "title_commitment",
  "deed",
  "easement",
  "plat",
  "survey",
  "legal_description",
  "attorney_letter",
  "utility_letter",
  "planning_comment",
  "drainage_report",
  "unknown",
] as const;

export type DocumentType = (typeof documentTypes)[number];
export type ProcessingStatus = "pending" | "complete" | "needs_ocr" | "failed";
export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface ProjectDocument {
  id: string;
  projectId: string;
  storagePath: string;
  originalFilename: string;
  documentType: DocumentType;
  title?: string | null;
  source?: string | null;
  recordingDate?: string | null;
  receptionNumber?: string | null;
  bookPage?: string | null;
  parsedStatus: ProcessingStatus;
  extractionStatus: ProcessingStatus;
  indexedStatus: ProcessingStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentPage {
  id: string;
  documentId: string;
  pageNumber: number;
  textContent: string | null;
  ocrConfidence?: number | null;
  parseMethod: "text" | "ocr" | "mock";
  createdAt?: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  pageStart: number | null;
  pageEnd: number | null;
  chunkIndex: number;
  chunkText: string;
  tokenCount: number | null;
  heading?: string | null;
  sectionLabel?: string | null;
  createdAt?: string;
}

export interface DocumentProcessingSummary {
  documentId: string;
  parsedStatus: ProcessingStatus;
  indexedStatus: ProcessingStatus;
  pageCount: number;
  chunkCount: number;
  warnings: string[];
}

export interface RetrievedChunk extends DocumentChunk {
  documentTitle?: string | null;
  score: number;
}

export interface DocumentExtractionRecord<T = unknown> {
  id: string;
  documentId: string;
  extractionType: string;
  modelName: string;
  schemaVersion: string;
  extractedJson: T;
  confidence?: number | null;
  warnings?: unknown;
  createdAt?: string;
}

export interface IngestionInput {
  projectId: string;
  storagePath: string;
  originalFilename: string;
  firstPageText?: string;
  title?: string | null;
}

export interface ParsedDocumentResult {
  status: ProcessingStatus;
  pages: Array<{
    pageNumber: number;
    textContent: string;
    parseMethod: DocumentPage["parseMethod"];
    ocrConfidence?: number | null;
  }>;
  warnings: string[];
}

export interface ChunkingOptions {
  targetTokens: number;
  overlapTokens: number;
}

export interface RetrievalOptions {
  topK?: number;
  documentTypeFilter?: DocumentType[];
  documentIds?: string[];
  sectionLabelBoost?: Record<string, number>;
}

export interface QaRequest {
  projectId: string;
  question: string;
  topK?: number;
  documentTypeFilter?: DocumentType[];
  documentIds?: string[];
}

export interface QaResponse {
  answer: string;
  citations: Array<{
    documentId: string;
    documentTitle?: string | null;
    pageStart: number | null;
    pageEnd: number | null;
    chunkId: string;
  }>;
  warnings: string[];
  modelName: string;
  latencyMs: number;
}

export interface DocumentEvalCase {
  id: string;
  projectId: string;
  name: string;
  question: string;
  expectedAnswer?: string | null;
  expectedCitationHint?: string | null;
  tags: string[];
  createdAt?: string;
}

export interface EvalRunSummary {
  caseId: string;
  question: string;
  answer: string;
  citedChunkIds: string[];
  pass: boolean | null;
  notes?: string | null;
}

export interface ExtractionPrompt<TSchema extends z.ZodTypeAny> {
  name: string;
  schemaVersion: string;
  instructions: string;
  schema: TSchema;
}
