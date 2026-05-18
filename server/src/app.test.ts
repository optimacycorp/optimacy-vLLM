import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type http from "node:http";
import { createAppServer } from "./app.js";
import { createProjectDocumentRepository } from "./modules/document-intelligence/documentRepository.js";

let tempDir: string;

describe("app server", () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "optimacy-vllm-"));
    process.env.LLM_PROVIDER = "mock";
    process.env.EMBEDDING_PROVIDER = "mock";
    process.env.ENABLE_AI_EXTRACTION = "false";
    process.env.ENABLE_RAG_QA = "true";
  });

  beforeEach(async () => {
    await rm(path.join(tempDir, "project-documents.json"), { force: true });
    await rm(path.join(tempDir, "storage"), { recursive: true, force: true });
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns runtime AI settings", async () => {
    const { baseUrl, close } = await startTestServer();
    const response = await fetch(`${baseUrl}/api/admin/ai-settings`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.llmProvider).toBe("mock");
    expect(body.embeddingProvider).toBe("mock");
    await close();
  });

  it("runs the admin AI settings test route in mock mode", async () => {
    const { baseUrl, close } = await startTestServer();
    const response = await fetch(`${baseUrl}/api/admin/ai-settings/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Return JSON with status ok" }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.provider).toBe("mock");
    expect(body.jsonValid).toBe(true);
    await close();
  });

  it("creates and lists project documents", async () => {
    const { baseUrl, close } = await startTestServer();
    const createResponse = await fetch(`${baseUrl}/api/projects/project-123/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalFilename: "Schedule B Commitment.pdf",
        sourceText: "Schedule A Schedule B commitment number example",
        title: "Commitment for Project 123",
      }),
    });
    const created = (await createResponse.json()) as { document: { documentType: string; id: string } };

    expect(createResponse.status).toBe(201);
    expect(created.document.documentType).toBe("title_commitment");

    const listResponse = await fetch(`${baseUrl}/api/projects/project-123/documents`);
    const listed = (await listResponse.json()) as { documents: Array<{ id: string }> };

    expect(listResponse.status).toBe(200);
    expect(listed.documents).toHaveLength(1);
    expect(listed.documents[0]?.id).toBe(created.document.id);
    await close();
  });

  it("stores source content on disk when creating a document", async () => {
    const { baseUrl, close } = await startTestServer();
    const sourceText = "Boundary research notes and source content that should be written to local storage.";

    const createResponse = await fetch(`${baseUrl}/api/projects/project-storage/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalFilename: "Research Notes.txt",
        sourceText,
      }),
    });
    const created = (await createResponse.json()) as { document: { storagePath: string } };

    expect(createResponse.status).toBe(201);
    const stored = await readFile(path.join(tempDir, "storage", created.document.storagePath), "utf8");
    expect(stored).toBe(sourceText);
    await close();
  });

  it("returns document detail and allows reparse and reindex transitions", async () => {
    const { baseUrl, close } = await startTestServer();
    const createResponse = await fetch(`${baseUrl}/api/projects/project-456/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalFilename: "Warranty Deed.pdf",
        sourceText:
          "Warranty deed grantor grantee legal description recording information with a longer body of text to ensure parsing sees a usable amount of extracted content for the first page of this mock document and treats it as complete rather than sparse.\n---page---\nReservations and exceptions for the conveyed property together with more detail about recording references, legal description support, and survey-related notes so the second page also contains enough content for mock parsing and chunking.",
      }),
    });
    const created = (await createResponse.json()) as { document: { id: string } };

    const workerResponse = await fetch(`${baseUrl}/api/admin/document-worker/run`, {
      method: "POST",
    });
    const workerBody = (await workerResponse.json()) as { processed: number };
    expect(workerResponse.status).toBe(200);
    expect(workerBody.processed).toBeGreaterThanOrEqual(1);

    const detailResponse = await fetch(`${baseUrl}/api/documents/${created.document.id}`);
    const detail = (await detailResponse.json()) as {
      document: { originalFilename: string; parsedStatus: string; indexedStatus: string };
      pages: Array<{ pageNumber: number }>;
      chunks: Array<{ chunkIndex: number }>;
    };
    expect(detailResponse.status).toBe(200);
    expect(detail.document.originalFilename).toBe("Warranty Deed.pdf");
    expect(detail.document.parsedStatus).toBe("complete");
    expect(detail.document.indexedStatus).toBe("complete");
    expect(detail.pages).toHaveLength(2);
    expect(detail.chunks.length).toBeGreaterThan(0);

    const reparseResponse = await fetch(`${baseUrl}/api/documents/${created.document.id}/reparse`, {
      method: "POST",
    });
    const reparsed = (await reparseResponse.json()) as {
      document: { parsedStatus: string };
      processing: { parsedStatus: string };
    };
    expect(reparseResponse.status).toBe(200);
    expect(reparsed.document.parsedStatus).toBe("pending");
    expect(reparsed.processing.parsedStatus).toBe("complete");

    const reindexResponse = await fetch(`${baseUrl}/api/documents/${created.document.id}/reindex`, {
      method: "POST",
    });
    const reindexed = (await reindexResponse.json()) as {
      document: { indexedStatus: string };
      processing: { indexedStatus: string };
    };
    expect(reindexResponse.status).toBe(200);
    expect(reindexed.document.indexedStatus).toBe("pending");
    expect(reindexed.processing.indexedStatus).toBe("complete");
    await close();
  });

  it("answers project document questions and logs QA runs", async () => {
    const { baseUrl, close } = await startTestServer();

    const createResponse = await fetch(`${baseUrl}/api/projects/project-qa/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalFilename: "Utility Easement.pdf",
        sourceText:
          "Utility easement affecting the property with access rights, maintenance rights, and recording information for the benefited parcel. This text is intentionally long enough to be treated as complete by the mock parser so retrieval and cited QA can run over a persisted chunk.",
      }),
    });
    expect(createResponse.status).toBe(201);

    const workerResponse = await fetch(`${baseUrl}/api/admin/document-worker/run`, { method: "POST" });
    expect(workerResponse.status).toBe(200);

    const qaResponse = await fetch(`${baseUrl}/api/projects/project-qa/document-qa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "What affects the property?",
        topK: 4,
      }),
    });
    const qaBody = (await qaResponse.json()) as {
      answer: string;
      citations: Array<{ chunkId: string }>;
      modelName: string;
    };

    expect(qaResponse.status).toBe(200);
    expect(qaBody.answer).toContain("Mock answer from retrieved context");
    expect(qaBody.citations.length).toBeGreaterThan(0);
    expect(qaBody.modelName).toBe("mock-llm");

    const runsResponse = await fetch(`${baseUrl}/api/projects/project-qa/document-qa-runs`);
    const runsBody = (await runsResponse.json()) as {
      runs: Array<{ question: string; citedChunkIds: string[] }>;
    };

    expect(runsResponse.status).toBe(200);
    expect(runsBody.runs).toHaveLength(1);
    expect(runsBody.runs[0]?.question).toBe("What affects the property?");
    expect(runsBody.runs[0]?.citedChunkIds.length).toBeGreaterThan(0);

    await close();
  });

  it("persists structured extractions for supported document types", async () => {
    const { baseUrl, close } = await startTestServer();

    const createResponse = await fetch(`${baseUrl}/api/projects/project-extract/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalFilename: "Title Commitment.pdf",
        sourceText:
          "Title commitment schedule a schedule b commitment number effective date proposed insured requirements exceptions legal description vested owner utility easement access rights ditch rights water rights. This mock source is intentionally long enough for parsing and indexing so extraction can run against persisted chunks.",
      }),
    });
    const created = (await createResponse.json()) as { document: { id: string } };
    expect(createResponse.status).toBe(201);

    const workerResponse = await fetch(`${baseUrl}/api/admin/document-worker/run`, { method: "POST" });
    expect(workerResponse.status).toBe(200);

    const extractionResponse = await fetch(`${baseUrl}/api/documents/${created.document.id}/extractions`, {
      method: "POST",
    });
    const extractionBody = (await extractionResponse.json()) as {
      extraction: { extractionType: string; extractedJson: { warnings: string[] } };
    };

    expect(extractionResponse.status).toBe(201);
    expect(extractionBody.extraction.extractionType).toBe("title_commitment");
    expect(Array.isArray(extractionBody.extraction.extractedJson.warnings)).toBe(true);

    const detailResponse = await fetch(`${baseUrl}/api/documents/${created.document.id}`);
    const detailBody = (await detailResponse.json()) as {
      document: { extractionStatus: string };
      extractions: Array<{ extractionType: string }>;
    };
    expect(detailResponse.status).toBe(200);
    expect(detailBody.document.extractionStatus).toBe("complete");
    expect(detailBody.extractions).toHaveLength(1);

    const projectExtractionsResponse = await fetch(`${baseUrl}/api/projects/project-extract/document-extractions`);
    const projectExtractionsBody = (await projectExtractionsResponse.json()) as {
      extractions: Array<{ documentId: string }>;
    };
    expect(projectExtractionsResponse.status).toBe(200);
    expect(projectExtractionsBody.extractions).toHaveLength(1);
    expect(projectExtractionsBody.extractions[0]?.documentId).toBe(created.document.id);

    await close();
  });

  it("generates and lists AI findings from persisted extractions", async () => {
    const { baseUrl, close } = await startTestServer();

    const createResponse = await fetch(`${baseUrl}/api/projects/project-findings/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalFilename: "Survey Utility Easement.pdf",
        sourceText:
          "Utility easement affecting the property with access rights, maintenance rights, legal description references, and survey relevance language. The document also mentions utility facilities, ditch concerns, and right of access in a way that should trigger survey-relevant findings after extraction. This text is long enough to pass mock parsing and indexing.",
      }),
    });
    const created = (await createResponse.json()) as { document: { id: string } };
    expect(createResponse.status).toBe(201);

    const workerResponse = await fetch(`${baseUrl}/api/admin/document-worker/run`, { method: "POST" });
    expect(workerResponse.status).toBe(200);

    const extractionResponse = await fetch(`${baseUrl}/api/documents/${created.document.id}/extractions`, {
      method: "POST",
    });
    const extractionBody = (await extractionResponse.json()) as {
      findings: Array<{ findingType: string }>;
    };
    expect(extractionResponse.status).toBe(201);
    expect(extractionBody.findings.length).toBeGreaterThan(0);

    const findingsResponse = await fetch(`${baseUrl}/api/documents/${created.document.id}/findings`);
    const findingsBody = (await findingsResponse.json()) as {
      findings: Array<{ findingType: string; severity: string }>;
    };
    expect(findingsResponse.status).toBe(200);
    expect(findingsBody.findings.length).toBeGreaterThan(0);

    const projectFindingsResponse = await fetch(`${baseUrl}/api/projects/project-findings/document-findings`);
    const projectFindingsBody = (await projectFindingsResponse.json()) as {
      findings: Array<{ documentId: string }>;
    };
    expect(projectFindingsResponse.status).toBe(200);
    expect(projectFindingsBody.findings.length).toBeGreaterThan(0);
    expect(projectFindingsBody.findings[0]?.documentId).toBe(created.document.id);

    await close();
  });
});

async function startTestServer() {
  const storePath = path.join(tempDir, "project-documents.json");
  process.env.DOCUMENT_STORAGE_ROOT = path.join(tempDir, "storage");
  const repository = createProjectDocumentRepository(storePath);
  const server = createAppServer({ projectDocumentRepository: repository });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP server address");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
