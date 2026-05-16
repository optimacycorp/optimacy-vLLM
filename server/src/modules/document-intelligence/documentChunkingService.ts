import { randomUUID } from "node:crypto";
import type { ChunkingOptions, DocumentChunk, DocumentPage, DocumentType } from "./types.js";

const headingPatterns: Record<DocumentType, Array<{ label: string; regex: RegExp }>> = {
  title_commitment: [
    { label: "Schedule A", regex: /schedule a/i },
    { label: "Schedule B-I", regex: /schedule b[- ]?i/i },
    { label: "Schedule B-II", regex: /schedule b[- ]?ii/i },
    { label: "Requirements", regex: /requirements/i },
    { label: "Exceptions", regex: /exceptions/i },
    { label: "Legal Description", regex: /legal description/i },
    { label: "Vesting", regex: /vesting/i },
  ],
  deed: [
    { label: "Grantor", regex: /grantor/i },
    { label: "Grantee", regex: /grantee/i },
    { label: "Consideration", regex: /consideration/i },
    { label: "Legal Description", regex: /legal description/i },
    { label: "Reservations", regex: /reservations?/i },
    { label: "Exceptions", regex: /exceptions?/i },
    { label: "Recording Information", regex: /recording/i },
  ],
  easement: [
    { label: "Grantor", regex: /grantor/i },
    { label: "Grantee", regex: /grantee/i },
    { label: "Easement Purpose", regex: /purpose/i },
    { label: "Burdened Property", regex: /burdened property/i },
    { label: "Benefited Property", regex: /benefited property/i },
    { label: "Width/Location", regex: /width|location/i },
    { label: "Maintenance Rights", regex: /maintenance/i },
    { label: "Access Rights", regex: /access/i },
  ],
  plat: [],
  survey: [],
  legal_description: [],
  attorney_letter: [],
  utility_letter: [],
  planning_comment: [],
  drainage_report: [],
  unknown: [],
};

export class DocumentChunkingService {
  chunkDocument(documentId: string, documentType: DocumentType, pages: DocumentPage[], options: ChunkingOptions): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let chunkIndex = 0;

    for (const page of pages) {
      const tokens = this.tokenize(page.textContent ?? "");
      let cursor = 0;

      while (cursor < tokens.length) {
        const slice = tokens.slice(cursor, cursor + options.targetTokens);
        const text = slice.join(" ").trim();

        if (text) {
          const heading = this.detectHeading(documentType, text);
          chunks.push({
            id: randomUUID(),
            documentId,
            pageStart: page.pageNumber,
            pageEnd: page.pageNumber,
            chunkIndex,
            chunkText: text,
            tokenCount: slice.length,
            heading,
            sectionLabel: heading,
            createdAt: new Date().toISOString(),
          });
          chunkIndex += 1;
        }

        if (cursor + options.targetTokens >= tokens.length) {
          break;
        }

        cursor += Math.max(1, options.targetTokens - options.overlapTokens);
      }
    }

    return chunks;
  }

  private tokenize(text: string): string[] {
    return text.split(/\s+/).filter(Boolean);
  }

  private detectHeading(documentType: DocumentType, text: string): string | null {
    const headings = headingPatterns[documentType] ?? [];
    const match = headings.find((entry) => entry.regex.test(text));
    return match?.label ?? null;
  }
}
