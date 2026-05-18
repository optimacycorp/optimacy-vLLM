import http from "node:http";
import { pathToFileURL } from "node:url";
import { createLlmClient } from "./modules/llm/createLlmClient.js";
import { getLlmProviderStatus, loadLlmConfig } from "./modules/llm/llmConfig.js";
import { createDocumentStorageService, type DocumentStorageService } from "./modules/document-intelligence/documentStorageService.js";
import { DocumentPipelineService } from "./modules/document-intelligence/documentPipelineService.js";
import { FindingsService } from "./modules/document-intelligence/findingsService.js";
import { ProjectExtractionService } from "./modules/document-intelligence/projectExtractionService.js";
import { ProjectQaService } from "./modules/document-intelligence/projectQaService.js";
import {
  createProjectDocumentRepository,
  type ProjectDocumentRepository,
} from "./modules/document-intelligence/documentRepository.js";

const port = Number(process.env.PORT ?? 3000);

interface CreateDocumentRequestBody {
  originalFilename?: string;
  storagePath?: string;
  firstPageText?: string;
  sourceText?: string;
  fileBase64?: string;
  mimeType?: string | null;
  title?: string | null;
  source?: string | null;
  recordingDate?: string | null;
  receptionNumber?: string | null;
  bookPage?: string | null;
}

interface ProjectDocumentQaRequestBody {
  question?: string;
  topK?: number;
  documentTypeFilter?: string[];
  documentIds?: string[];
}

function buildStartupPage() {
  const status = getLlmProviderStatus();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Optimacy Geomatics</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      color-scheme: light;
      --bg: #efe8db;
      --panel: #ffffff;
      --ink: #17323a;
      --muted: #5f6c72;
      --accent: #b86b32;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(184, 107, 50, 0.18), transparent 30%),
        linear-gradient(180deg, #f7f2e9 0%, var(--bg) 100%);
      color: var(--ink);
    }
    main {
      max-width: 920px;
      margin: 72px auto;
      padding: 32px;
    }
    .card {
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(23, 50, 58, 0.08);
      border-radius: 24px;
      padding: 36px;
      box-shadow: 0 18px 40px rgba(23, 50, 58, 0.08);
      backdrop-filter: blur(8px);
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.8rem;
      color: var(--accent);
      margin: 0 0 12px;
    }
    h1 {
      margin: 0 0 12px;
      font-size: clamp(2rem, 4vw, 3.8rem);
      line-height: 1.05;
    }
    p {
      margin: 0 0 16px;
      color: var(--muted);
      line-height: 1.7;
      font-size: 1.05rem;
    }
    .status {
      display: inline-block;
      margin-top: 12px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(184, 107, 50, 0.12);
      color: var(--ink);
      font-weight: 600;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-top: 28px;
    }
    .tile {
      padding: 18px;
      border-radius: 16px;
      background: #f8f6f1;
      border: 1px solid rgba(23, 50, 58, 0.08);
    }
    .tile strong {
      display: block;
      margin-bottom: 8px;
      color: var(--ink);
    }
    code {
      font-family: Consolas, monospace;
    }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <p class="eyebrow">Optimacy Geomatics Services LLC</p>
      <h1>Colorado geomatics support with a live deployment foothold.</h1>
      <p>The live app now exposes runtime AI status endpoints alongside the startup page, so we can validate provider mode before wiring real document upload and retrieval flows.</p>
      <p>When you can see this page and hit the JSON endpoints below, Nginx to Node proxying is healthy and the server runtime is up.</p>
      <span class="status">Startup service online on port ${port}</span>
      <div class="grid">
        <div class="tile">
          <strong>Current mode</strong>
          <span>${status.llmProvider}</span>
        </div>
        <div class="tile">
          <strong>Model</strong>
          <span>${status.modelName}</span>
        </div>
        <div class="tile">
          <strong>Health endpoint</strong>
          <span><code>/health</code></span>
        </div>
        <div class="tile">
          <strong>Admin runtime API</strong>
          <span><code>/api/admin/ai-settings</code></span>
        </div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function writeJson(response: http.ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function matchRoute(pathname: string, pattern: RegExp): RegExpExecArray | null {
  return pattern.exec(pathname);
}

function isAuthorized(request: http.IncomingMessage): boolean {
  const configuredToken = process.env.ADMIN_API_TOKEN;
  if (!configuredToken) {
    return true;
  }

  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  return bearer === configuredToken || request.headers["x-admin-token"] === configuredToken;
}

interface AppServerDependencies {
  projectDocumentRepository?: ProjectDocumentRepository;
  documentStorageService?: DocumentStorageService;
}

export function createAppServer(dependencies: AppServerDependencies = {}) {
  const projectDocumentRepository = dependencies.projectDocumentRepository ?? createProjectDocumentRepository();
  const documentStorageService = dependencies.documentStorageService ?? createDocumentStorageService();
  const documentPipelineService = new DocumentPipelineService(projectDocumentRepository, undefined, undefined, documentStorageService);
  const llmClient = createLlmClient(loadLlmConfig());
  const findingsService = new FindingsService(projectDocumentRepository);
  const projectExtractionService = new ProjectExtractionService(projectDocumentRepository, llmClient);
  const projectQaService = new ProjectQaService(projectDocumentRepository, llmClient);

  return http.createServer(async (request, response) => {
    try {
      if (!request.url || !request.method) {
        writeJson(response, 400, { error: "Invalid request" });
        return;
      }

      const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
      const pathname = url.pathname;

      if (pathname === "/health" && request.method === "GET") {
        writeJson(response, 200, {
          status: "ok",
          service: "waymail-portal",
          port,
          llmProvider: getLlmProviderStatus().llmProvider,
        });
        return;
      }

      if (pathname === "/api/admin/ai-settings" && request.method === "GET") {
        if (!isAuthorized(request)) {
          writeJson(response, 403, { error: "Forbidden" });
          return;
        }

        writeJson(response, 200, getLlmProviderStatus());
        return;
      }

      if (pathname === "/api/admin/ai-settings/test" && request.method === "POST") {
        if (!isAuthorized(request)) {
          writeJson(response, 403, { error: "Forbidden" });
          return;
        }

        const body = (await readJsonBody(request)) as { prompt?: string };
        const prompt = body.prompt?.trim();
        if (!prompt) {
          writeJson(response, 400, { error: "A prompt is required." });
          return;
        }

        const llmConfig = loadLlmConfig();
        const client = createLlmClient(llmConfig);
        const result = await client.chat({
          system: "Respond briefly. Return JSON when asked for JSON.",
          messages: [{ role: "user", content: prompt }],
          responseFormat: /json/i.test(prompt) ? "json" : "text",
          metadata: { promptVersion: "admin-ai-settings-test-v1" },
        });

        writeJson(response, 200, {
          provider: result.provider,
          modelName: result.modelName,
          latencyMs: result.latencyMs,
          text: result.text,
          jsonValid: result.json !== undefined,
        });
        return;
      }

      const projectDocumentsMatch = matchRoute(pathname, /^\/api\/projects\/([^/]+)\/documents$/);
      if (projectDocumentsMatch && request.method === "GET") {
        const [, projectId] = projectDocumentsMatch;
        const documents = await projectDocumentRepository.listByProjectId(projectId);
        writeJson(response, 200, { documents });
        return;
      }

      const projectExtractionsMatch = matchRoute(pathname, /^\/api\/projects\/([^/]+)\/document-extractions$/);
      if (projectExtractionsMatch && request.method === "GET") {
        const [, projectId] = projectExtractionsMatch;
        const extractions = await projectDocumentRepository.listExtractionsByProjectId(projectId);
        writeJson(response, 200, { extractions });
        return;
      }

      const projectFindingsMatch = matchRoute(pathname, /^\/api\/projects\/([^/]+)\/document-findings$/);
      if (projectFindingsMatch && request.method === "GET") {
        const [, projectId] = projectFindingsMatch;
        const findings = await projectDocumentRepository.listFindingsByProjectId(projectId);
        writeJson(response, 200, { findings });
        return;
      }

      const projectQaMatch = matchRoute(pathname, /^\/api\/projects\/([^/]+)\/document-qa$/);
      if (projectQaMatch && request.method === "POST") {
        const [, projectId] = projectQaMatch;
        const body = (await readJsonBody(request)) as ProjectDocumentQaRequestBody;
        const question = body.question?.trim();

        if (!question) {
          writeJson(response, 400, { error: "question is required." });
          return;
        }

        const qaResponse = await projectQaService.answerQuestion({
          projectId,
          question,
          topK: body.topK,
          documentIds: body.documentIds,
          documentTypeFilter: body.documentTypeFilter as never,
        });

        writeJson(response, 200, qaResponse);
        return;
      }

      const projectQaRunsMatch = matchRoute(pathname, /^\/api\/projects\/([^/]+)\/document-qa-runs$/);
      if (projectQaRunsMatch && request.method === "GET") {
        const [, projectId] = projectQaRunsMatch;
        const runs = await projectDocumentRepository.listQaRunsByProjectId(projectId);
        writeJson(response, 200, { runs });
        return;
      }

      if (projectDocumentsMatch && request.method === "POST") {
        const [, projectId] = projectDocumentsMatch;
        const body = (await readJsonBody(request)) as CreateDocumentRequestBody;
        const originalFilename = body.originalFilename?.trim();

        if (!originalFilename) {
          writeJson(response, 400, { error: "originalFilename is required." });
          return;
        }

        const storedDocument = await documentStorageService.saveDocument({
          projectId,
          originalFilename,
          sourceText: body.sourceText ?? body.firstPageText,
          fileBase64: body.fileBase64,
          mimeType: body.mimeType ?? null,
        });

        const document = await projectDocumentRepository.create({
          projectId,
          originalFilename,
          storagePath: storedDocument.storagePath,
          firstPageText: storedDocument.sourceText ?? undefined,
          title: body.title ?? null,
          source: body.source ?? null,
          recordingDate: body.recordingDate ?? null,
          receptionNumber: body.receptionNumber ?? null,
          bookPage: body.bookPage ?? null,
        });

        if (storedDocument.sourceText?.trim()) {
          await projectDocumentRepository.setSourceText(document.id, storedDocument.sourceText);
        }

        writeJson(response, 201, {
          document,
          queued: {
            parse: true,
            index: false,
            extract: false,
          },
        });
        return;
      }

      const documentDetailMatch = matchRoute(pathname, /^\/api\/documents\/([^/]+)$/);
      if (documentDetailMatch && request.method === "GET") {
        const [, documentId] = documentDetailMatch;
        const detail = await documentPipelineService.getDocumentDetail(documentId);
        if (!detail) {
          writeJson(response, 404, { error: "Document not found." });
          return;
        }

        writeJson(response, 200, detail);
        return;
      }

      const documentExtractionsMatch = matchRoute(pathname, /^\/api\/documents\/([^/]+)\/extractions$/);
      if (documentExtractionsMatch && request.method === "GET") {
        const [, documentId] = documentExtractionsMatch;
        const document = await projectDocumentRepository.getById(documentId);
        if (!document) {
          writeJson(response, 404, { error: "Document not found." });
          return;
        }

        const extractions = await projectDocumentRepository.listExtractionsByDocumentId(documentId);
        writeJson(response, 200, { extractions });
        return;
      }

      if (documentExtractionsMatch && request.method === "POST") {
        const [, documentId] = documentExtractionsMatch;
        const document = await projectDocumentRepository.getById(documentId);
        if (!document) {
          writeJson(response, 404, { error: "Document not found." });
          return;
        }

        try {
          const extraction = await projectExtractionService.extractDocument(documentId);
          const findings = await findingsService.generateForDocument(documentId);
          writeJson(response, 201, { extraction, findings });
        } catch (error) {
          writeJson(response, 400, {
            error: error instanceof Error ? error.message : "Extraction failed.",
          });
        }
        return;
      }

      const documentFindingsMatch = matchRoute(pathname, /^\/api\/documents\/([^/]+)\/findings$/);
      if (documentFindingsMatch && request.method === "GET") {
        const [, documentId] = documentFindingsMatch;
        const document = await projectDocumentRepository.getById(documentId);
        if (!document) {
          writeJson(response, 404, { error: "Document not found." });
          return;
        }

        const findings = await projectDocumentRepository.listFindingsByDocumentId(documentId);
        writeJson(response, 200, { findings });
        return;
      }

      if (documentFindingsMatch && request.method === "POST") {
        const [, documentId] = documentFindingsMatch;
        const document = await projectDocumentRepository.getById(documentId);
        if (!document) {
          writeJson(response, 404, { error: "Document not found." });
          return;
        }

        const findings = await findingsService.generateForDocument(documentId);
        writeJson(response, 201, { findings });
        return;
      }

      const reparseMatch = matchRoute(pathname, /^\/api\/documents\/([^/]+)\/reparse$/);
      if (reparseMatch && request.method === "POST") {
        const [, documentId] = reparseMatch;
        const document = await projectDocumentRepository.updateStatuses(documentId, {
          parsedStatus: "pending",
        });
        if (!document) {
          writeJson(response, 404, { error: "Document not found." });
          return;
        }

        const summary = await documentPipelineService.processDocument(documentId);
        writeJson(response, 200, {
          document,
          queued: { parse: true },
          processing: summary,
        });
        return;
      }

      const reindexMatch = matchRoute(pathname, /^\/api\/documents\/([^/]+)\/reindex$/);
      if (reindexMatch && request.method === "POST") {
        const [, documentId] = reindexMatch;
        const document = await projectDocumentRepository.updateStatuses(documentId, {
          indexedStatus: "pending",
        });
        if (!document) {
          writeJson(response, 404, { error: "Document not found." });
          return;
        }

        const summary = await documentPipelineService.processDocument(documentId);
        writeJson(response, 200, {
          document,
          queued: { index: true },
          processing: summary,
        });
        return;
      }

      if (pathname === "/api/admin/document-worker/run" && request.method === "POST") {
        if (!isAuthorized(request)) {
          writeJson(response, 403, { error: "Forbidden" });
          return;
        }

        const results = await documentPipelineService.processPendingDocumentsOnce();
        writeJson(response, 200, { processed: results.length, results });
        return;
      }

      if (pathname === "/" && request.method === "GET") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(buildStartupPage());
        return;
      }

      writeJson(response, 404, { error: "Not found" });
    } catch (error) {
      console.error("Unhandled request error", error);
      writeJson(response, 500, { error: "Internal server error" });
    }
  });
}

export function startAppServer(server = createAppServer()) {
  server.listen(port, "0.0.0.0", () => {
    console.log(`Waymail portal listening on http://0.0.0.0:${port}`);
  });

  return server;
}

const isEntrypoint = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) {
  startAppServer();
}
