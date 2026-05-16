import type { ParsedDocumentResult } from "./types.js";

export class DocumentParsingService {
  parseTextPages(textPages: string[]): ParsedDocumentResult {
    const pages = textPages.map((textContent, index) => ({
      pageNumber: index + 1,
      textContent,
      parseMethod: "mock" as const,
      ocrConfidence: null,
    }));

    const totalCharacters = textPages.reduce((sum, page) => sum + page.replace(/\s+/g, "").length, 0);
    const status = totalCharacters < 200 ? "needs_ocr" : "complete";
    const warnings = status === "needs_ocr" ? ["Sparse extracted text detected; OCR likely required."] : [];

    return { status, pages, warnings };
  }
}
