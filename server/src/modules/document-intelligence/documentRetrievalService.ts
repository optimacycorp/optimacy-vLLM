import type { DocumentChunk, RetrievalOptions, RetrievedChunk } from "./types.js";

export class DocumentRetrievalService {
  retrieveProjectContext(query: string, chunks: DocumentChunk[], options: RetrievalOptions = {}): RetrievedChunk[] {
    const queryTerms = this.normalize(query);
    const topK = options.topK ?? 8;

    return chunks
      .filter((chunk) => !options.documentIds || options.documentIds.includes(chunk.documentId))
      .map((chunk) => {
        const textTerms = this.normalize(chunk.chunkText);
        const intersection = queryTerms.filter((term) => textTerms.includes(term)).length;
        const headingBoost = chunk.sectionLabel ? options.sectionLabelBoost?.[chunk.sectionLabel] ?? 0 : 0;
        return {
          ...chunk,
          score: intersection + headingBoost,
        };
      })
      .filter((chunk) => chunk.score > 0)
      .sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex)
      .slice(0, topK);
  }

  private normalize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2);
  }
}
