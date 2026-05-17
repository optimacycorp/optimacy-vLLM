import { describe, expect, it } from "vitest";
import { createDocumentIntelligenceModule } from "./index.js";

describe("document intelligence scaffold", () => {
  it("instantiates all services", () => {
    const module = createDocumentIntelligenceModule({
      provider: "mock",
      defaultTemperature: 0.1,
      defaultMaxTokens: 1200,
      timeoutMs: 120000,
      runpod: {
        baseUrl: null,
        apiKey: null,
        modelName: "Qwen/Qwen2.5-7B-Instruct",
      },
      openai: {
        baseUrl: "https://api.openai.com/v1",
        apiKey: null,
        modelName: "gpt-4o-mini",
      },
      local: {
        baseUrl: "http://localhost:8000/v1",
        apiKey: "local-dev-key",
        modelName: "local-dev-model",
      },
    });

    expect(module.ingestionService).toBeDefined();
    expect(module.parsingService).toBeDefined();
    expect(module.chunkingService).toBeDefined();
    expect(module.retrievalService).toBeDefined();
    expect(module.extractionService).toBeDefined();
    expect(module.qaService).toBeDefined();
    expect(module.evaluationService).toBeDefined();
  });

  it("retrieves matching chunks for query terms", () => {
    const module = createDocumentIntelligenceModule({
      provider: "mock",
      defaultTemperature: 0.1,
      defaultMaxTokens: 1200,
      timeoutMs: 120000,
      runpod: {
        baseUrl: null,
        apiKey: null,
        modelName: "Qwen/Qwen2.5-7B-Instruct",
      },
      openai: {
        baseUrl: "https://api.openai.com/v1",
        apiKey: null,
        modelName: "gpt-4o-mini",
      },
      local: {
        baseUrl: "http://localhost:8000/v1",
        apiKey: "local-dev-key",
        modelName: "local-dev-model",
      },
    });

    const chunks = [
      {
        id: "chunk-1",
        documentId: "doc-1",
        pageStart: 1,
        pageEnd: 1,
        chunkIndex: 0,
        chunkText: "Schedule B exception for a utility easement across the property.",
        tokenCount: 10,
        heading: "Schedule B-II",
        sectionLabel: "Schedule B-II",
      },
      {
        id: "chunk-2",
        documentId: "doc-1",
        pageStart: 2,
        pageEnd: 2,
        chunkIndex: 1,
        chunkText: "Warranty deed naming grantor and grantee.",
        tokenCount: 8,
        heading: "Grantor",
        sectionLabel: "Grantor",
      },
    ];

    const results = module.retrievalService.retrieveProjectContext("utility easement", chunks, { topK: 3 });
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("chunk-1");
  });
});
