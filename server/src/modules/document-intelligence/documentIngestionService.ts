import { randomUUID } from "node:crypto";
import type { DocumentType, IngestionInput, ProjectDocument } from "./types.js";

const documentTypeHeuristics: Array<{ type: DocumentType; patterns: RegExp[] }> = [
  { type: "title_commitment", patterns: [/commitment/i, /schedule a/i, /schedule b/i] },
  { type: "deed", patterns: [/warranty deed/i, /quit claim/i, /special warranty/i, /\bdeed\b/i] },
  { type: "easement", patterns: [/easement/i, /right[- ]of[- ]way/i, /utility easement/i] },
  { type: "plat", patterns: [/\bplat\b/i, /subdivision/i] },
  { type: "survey", patterns: [/improvement survey/i, /land survey/i, /retracement/i, /\bsurvey\b/i] },
  { type: "legal_description", patterns: [/legal description/i] },
];

export class DocumentIngestionService {
  detectDocumentType(filename: string, firstPageText = ""): DocumentType {
    const haystack = `${filename}\n${firstPageText}`;
    const match = documentTypeHeuristics.find((entry) => entry.patterns.some((pattern) => pattern.test(haystack)));
    return match?.type ?? "unknown";
  }

  createPendingDocument(input: IngestionInput): ProjectDocument {
    return {
      id: randomUUID(),
      projectId: input.projectId,
      storagePath: input.storagePath,
      originalFilename: input.originalFilename,
      documentType: this.detectDocumentType(input.originalFilename, input.firstPageText),
      title: input.title ?? null,
      parsedStatus: "pending",
      extractionStatus: "pending",
      indexedStatus: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
