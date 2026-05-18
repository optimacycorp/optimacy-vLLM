import http from "node:http";
import { pathToFileURL } from "node:url";
import { loadDocumentBackendConfig } from "./modules/document-intelligence/documentBackendConfig.js";
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
  <title>Optimacy Geomatics Document Console</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      color-scheme: light;
      --bg: #f1eadf;
      --panel: rgba(255, 255, 255, 0.94);
      --ink: #19333a;
      --muted: #5a676d;
      --accent: #b76d34;
      --accent-dark: #8f5124;
      --border: rgba(25, 51, 58, 0.12);
      --surface: #f8f5ef;
      --success: #1f6d57;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(183, 109, 52, 0.18), transparent 26%),
        linear-gradient(180deg, #faf5eb 0%, var(--bg) 100%);
      color: var(--ink);
    }
    main {
      max-width: 1280px;
      margin: 40px auto 64px;
      padding: 24px;
    }
    .shell {
      display: grid;
      gap: 20px;
    }
    .hero {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 18px 40px rgba(25, 51, 58, 0.08);
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
      font-size: clamp(2rem, 4vw, 3.4rem);
      line-height: 1.04;
    }
    p {
      margin: 0 0 16px;
      color: var(--muted);
      line-height: 1.65;
      font-size: 1rem;
    }
    .status-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 16px;
    }
    .status {
      display: inline-block;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(183, 109, 52, 0.12);
      color: var(--ink);
      font-weight: 600;
    }
    .dashboard {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 20px;
      align-items: start;
    }
    .panel-grid {
      display: grid;
      gap: 20px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 22px;
      box-shadow: 0 14px 30px rgba(25, 51, 58, 0.06);
    }
    .panel h2 {
      margin: 0 0 14px;
      font-size: 1.25rem;
    }
    .subtle {
      color: var(--muted);
      font-size: 0.94rem;
    }
    .tile-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 18px;
    }
    .tile {
      padding: 16px;
      border-radius: 16px;
      background: var(--surface);
      border: 1px solid var(--border);
    }
    .tile strong {
      display: block;
      margin-bottom: 8px;
      color: var(--ink);
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .field {
      display: grid;
      gap: 8px;
    }
    .field.full {
      grid-column: 1 / -1;
    }
    label {
      font-size: 0.92rem;
      font-weight: 600;
      color: var(--ink);
    }
    input, textarea, select {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 14px;
      font: inherit;
      color: var(--ink);
      background: white;
    }
    textarea {
      min-height: 132px;
      resize: vertical;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }
    button {
      appearance: none;
      border: none;
      border-radius: 999px;
      padding: 11px 16px;
      font: inherit;
      font-weight: 700;
      color: white;
      background: var(--accent);
      cursor: pointer;
      transition: transform 120ms ease, background 120ms ease;
    }
    button:hover {
      background: var(--accent-dark);
      transform: translateY(-1px);
    }
    button.secondary {
      background: #27424a;
    }
    button.ghost {
      background: #dfe7e4;
      color: var(--ink);
    }
    .doc-list {
      display: grid;
      gap: 10px;
      margin-top: 14px;
      max-height: 420px;
      overflow: auto;
      padding-right: 4px;
    }
    .doc-card {
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 14px;
      background: var(--surface);
      cursor: pointer;
    }
    .doc-card.selected {
      border-color: rgba(183, 109, 52, 0.5);
      box-shadow: inset 0 0 0 1px rgba(183, 109, 52, 0.25);
    }
    .doc-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .badge {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(25, 51, 58, 0.08);
      font-size: 0.84rem;
    }
    .result {
      margin-top: 14px;
      border-radius: 18px;
      background: #101b20;
      color: #e9f2ef;
      padding: 16px;
      min-height: 520px;
      overflow: auto;
      white-space: pre-wrap;
      font-family: Consolas, "Courier New", monospace;
      font-size: 0.9rem;
      line-height: 1.55;
    }
    .hint {
      margin-top: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(31, 109, 87, 0.08);
      color: var(--success);
      font-size: 0.92rem;
    }
    code {
      font-family: Consolas, monospace;
    }
    @media (max-width: 980px) {
      .dashboard {
        grid-template-columns: 1fr;
      }
      .form-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main>
    <div class="shell">
      <section class="hero">
        <p class="eyebrow">Optimacy Geomatics Services LLC</p>
        <h1>Document Intelligence Mock Console</h1>
        <p>This page lets you upload a document, run the worker, inspect parsed results, call QA and extraction endpoints, and verify the local or Supabase backend wiring from the browser on RackNerd.</p>
        <div class="status-row">
          <span class="status">Portal online on port ${port}</span>
          <span class="status">LLM provider: ${status.llmProvider}</span>
          <span class="status">Model: ${status.modelName}</span>
        </div>
        <div class="tile-row">
          <div class="tile">
            <strong>Mock-friendly workflow</strong>
            <span>Upload, process, inspect, QA, extract, and review findings without GPU spend.</span>
          </div>
          <div class="tile">
            <strong>Project default</strong>
            <span><code>demo-project</code> is prefilled, but you can switch projects at any time.</span>
          </div>
          <div class="tile">
            <strong>Admin routes</strong>
            <span>Provide an admin token below only if your server has <code>ADMIN_API_TOKEN</code> enabled.</span>
          </div>
        </div>
      </section>

      <section class="dashboard">
        <div class="panel-grid">
          <section class="panel">
            <h2>Runtime Checks</h2>
            <p class="subtle">Use these first to confirm the live environment is healthy before testing document flows.</p>
            <div class="form-grid">
              <div class="field">
                <label for="projectId">Project ID</label>
                <input id="projectId" value="demo-project" />
              </div>
              <div class="field">
                <label for="adminToken">Admin Token (optional)</label>
                <input id="adminToken" type="password" placeholder="Only needed if ADMIN_API_TOKEN is set" />
              </div>
            </div>
            <div class="actions">
              <button type="button" data-action="health">Health</button>
              <button type="button" data-action="ai-settings">AI Settings</button>
              <button type="button" data-action="backend-status">Backend Status</button>
              <button type="button" data-action="run-worker" class="secondary">Run Worker</button>
              <button type="button" data-action="list-docs" class="ghost">Refresh Documents</button>
            </div>
            <div class="hint">Tip: if backend status shows storage healthy and AI settings show <code>mock</code>, you have a solid RackNerd mock baseline.</div>
          </section>

          <section class="panel">
            <h2>Upload Document</h2>
            <p class="subtle">Use either a real file upload or paste source text directly for a fast mock test.</p>
            <form id="uploadForm">
              <div class="form-grid">
                <div class="field">
                  <label for="originalFilename">Original Filename</label>
                  <input id="originalFilename" placeholder="Title Commitment.pdf" />
                </div>
                <div class="field">
                  <label for="documentTitle">Document Title</label>
                  <input id="documentTitle" placeholder="Optional display title" />
                </div>
                <div class="field">
                  <label for="mimeType">MIME Type</label>
                  <input id="mimeType" placeholder="text/plain or application/pdf" />
                </div>
                <div class="field">
                  <label for="fileInput">Upload File</label>
                  <input id="fileInput" type="file" />
                </div>
                <div class="field full">
                  <label for="sourceText">Source Text</label>
                  <textarea id="sourceText" placeholder="Paste mock title, deed, easement, or survey text here if you are not uploading a file."></textarea>
                </div>
              </div>
              <div class="actions">
                <button type="submit">Upload Document</button>
              </div>
            </form>
          </section>

          <section class="panel">
            <h2>Project QA</h2>
            <p class="subtle">Run a grounded mock question over the current project documents after processing.</p>
            <div class="form-grid">
              <div class="field full">
                <label for="qaQuestion">Question</label>
                <textarea id="qaQuestion">What affects the property?</textarea>
              </div>
            </div>
            <div class="actions">
              <button type="button" data-action="run-qa">Run QA</button>
              <button type="button" data-action="qa-runs" class="ghost">View QA Runs</button>
              <button type="button" data-action="export-project" class="ghost">Export Project JSON</button>
            </div>
          </section>
        </div>

        <div class="panel-grid">
          <section class="panel">
            <h2>Documents</h2>
            <p class="subtle">Click a document below to target detail, source, extraction, and findings actions.</p>
            <div class="actions">
              <button type="button" data-action="doc-detail" class="secondary">Document Detail</button>
              <button type="button" data-action="doc-source" class="ghost">Source Text</button>
              <button type="button" data-action="doc-extract">Run Extraction</button>
              <button type="button" data-action="doc-findings" class="ghost">View Findings</button>
            </div>
            <div id="docList" class="doc-list"></div>
          </section>

          <section class="panel">
            <h2>API Results</h2>
            <p class="subtle">All responses are shown here so you can verify route behavior without leaving the page.</p>
            <div id="result" class="result">Ready. Start with Health, AI Settings, or Upload Document.</div>
          </section>
        </div>
      </section>
    </div>
  </main>
  <script>
    const state = {
      selectedDocumentId: null,
      documents: [],
    };

    const els = {
      projectId: document.getElementById("projectId"),
      adminToken: document.getElementById("adminToken"),
      originalFilename: document.getElementById("originalFilename"),
      documentTitle: document.getElementById("documentTitle"),
      mimeType: document.getElementById("mimeType"),
      fileInput: document.getElementById("fileInput"),
      sourceText: document.getElementById("sourceText"),
      qaQuestion: document.getElementById("qaQuestion"),
      uploadForm: document.getElementById("uploadForm"),
      result: document.getElementById("result"),
      docList: document.getElementById("docList"),
    };

    function getProjectId() {
      return (els.projectId.value || "demo-project").trim();
    }

    function getAdminHeaders() {
      const token = els.adminToken.value.trim();
      return token ? { Authorization: \`Bearer \${token}\` } : {};
    }

    function renderResult(label, payload) {
      els.result.textContent = label + "\\n\\n" + JSON.stringify(payload, null, 2);
    }

    function renderError(label, error) {
      const message = error instanceof Error ? error.message : String(error);
      els.result.textContent = label + "\\n\\n" + message;
    }

    async function requestJson(url, options = {}) {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          ...getAdminHeaders(),
        },
      });

      let payload;
      try {
        payload = await response.json();
      } catch {
        payload = { status: response.status, text: await response.text() };
      }

      if (!response.ok) {
        throw new Error(JSON.stringify(payload, null, 2));
      }

      return payload;
    }

    function renderDocuments() {
      if (state.documents.length === 0) {
        els.docList.innerHTML = '<div class="doc-card">No documents yet for this project.</div>';
        return;
      }

      els.docList.innerHTML = state.documents.map((document) => {
        const selected = state.selectedDocumentId === document.id ? "selected" : "";
        return \`
          <button type="button" class="doc-card \${selected}" data-document-id="\${document.id}">
            <strong>\${document.originalFilename}</strong>
            <div class="subtle">\${document.documentType || "unknown"}</div>
            <div class="doc-meta">
              <span class="badge">parsed: \${document.parsedStatus}</span>
              <span class="badge">indexed: \${document.indexedStatus}</span>
              <span class="badge">extracted: \${document.extractionStatus}</span>
            </div>
          </button>
        \`;
      }).join("");

      for (const button of els.docList.querySelectorAll("[data-document-id]")) {
        button.addEventListener("click", () => {
          state.selectedDocumentId = button.getAttribute("data-document-id");
          renderDocuments();
        });
      }
    }

    async function refreshDocuments() {
      const payload = await requestJson(\`/api/projects/\${encodeURIComponent(getProjectId())}/documents\`);
      state.documents = payload.documents || [];
      if (!state.selectedDocumentId && state.documents[0]) {
        state.selectedDocumentId = state.documents[0].id;
      } else if (state.selectedDocumentId && !state.documents.find((doc) => doc.id === state.selectedDocumentId)) {
        state.selectedDocumentId = state.documents[0] ? state.documents[0].id : null;
      }
      renderDocuments();
      renderResult("Project documents", payload);
    }

    function requireSelectedDocumentId() {
      if (!state.selectedDocumentId) {
        throw new Error("Select a document first.");
      }
      return state.selectedDocumentId;
    }

    async function runAction(action) {
      try {
        if (action === "health") {
          renderResult("Health", await requestJson("/health"));
          return;
        }
        if (action === "ai-settings") {
          renderResult("AI settings", await requestJson("/api/admin/ai-settings"));
          return;
        }
        if (action === "backend-status") {
          renderResult("Document backend status", await requestJson("/api/admin/document-backend-status"));
          return;
        }
        if (action === "run-worker") {
          const payload = await requestJson("/api/admin/document-worker/run", { method: "POST" });
          await refreshDocuments();
          renderResult("Worker run", payload);
          return;
        }
        if (action === "list-docs") {
          await refreshDocuments();
          return;
        }
        if (action === "run-qa") {
          const payload = await requestJson(\`/api/projects/\${encodeURIComponent(getProjectId())}/document-qa\`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: els.qaQuestion.value.trim(),
              topK: 4,
            }),
          });
          renderResult("QA result", payload);
          return;
        }
        if (action === "qa-runs") {
          renderResult("QA runs", await requestJson(\`/api/projects/\${encodeURIComponent(getProjectId())}/document-qa-runs\`));
          return;
        }
        if (action === "export-project") {
          renderResult("Project export", await requestJson(\`/api/projects/\${encodeURIComponent(getProjectId())}/export.json\`));
          return;
        }

        const documentId = requireSelectedDocumentId();
        if (action === "doc-detail") {
          renderResult("Document detail", await requestJson(\`/api/documents/\${documentId}\`));
          return;
        }
        if (action === "doc-source") {
          renderResult("Document source", await requestJson(\`/api/documents/\${documentId}/source-text\`));
          return;
        }
        if (action === "doc-extract") {
          renderResult("Document extraction", await requestJson(\`/api/documents/\${documentId}/extractions\`, { method: "POST" }));
          await refreshDocuments();
          return;
        }
        if (action === "doc-findings") {
          renderResult("Document findings", await requestJson(\`/api/documents/\${documentId}/findings\`));
        }
      } catch (error) {
        renderError(\`Action failed: \${action}\`, error);
      }
    }

    els.uploadForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        const file = els.fileInput.files && els.fileInput.files[0];
        let payload;

        if (file) {
          const formData = new FormData();
          if (els.originalFilename.value.trim()) {
            formData.append("originalFilename", els.originalFilename.value.trim());
          }
          if (els.documentTitle.value.trim()) {
            formData.append("title", els.documentTitle.value.trim());
          }
          if (els.mimeType.value.trim()) {
            formData.append("mimeType", els.mimeType.value.trim());
          }
          formData.append("file", file, file.name);
          payload = await requestJson(\`/api/projects/\${encodeURIComponent(getProjectId())}/documents\`, {
            method: "POST",
            body: formData,
          });
        } else {
          payload = await requestJson(\`/api/projects/\${encodeURIComponent(getProjectId())}/documents\`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              originalFilename: els.originalFilename.value.trim() || "Mock Upload.txt",
              title: els.documentTitle.value.trim() || null,
              mimeType: els.mimeType.value.trim() || null,
              sourceText: els.sourceText.value,
            }),
          });
        }

        await refreshDocuments();
        renderResult("Upload result", payload);
        els.fileInput.value = "";
      } catch (error) {
        renderError("Upload failed", error);
      }
    });

    for (const button of document.querySelectorAll("[data-action]")) {
      button.addEventListener("click", () => runAction(button.getAttribute("data-action")));
    }

    refreshDocuments().catch((error) => renderError("Initial document load failed", error));
  </script>
</body>
</html>`;
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const raw = (await readRequestBody(request)).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function readRequestBody(request: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
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

interface MultipartPart {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

function parseMultipartFormData(contentType: string, body: Buffer): MultipartPart[] {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundaryToken = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundaryToken) {
    throw new Error("Missing multipart boundary.");
  }

  const boundary = `--${boundaryToken}`;
  const raw = body.toString("latin1");
  const segments = raw.split(boundary).slice(1, -1);

  return segments.flatMap((segment) => {
    const normalized = segment.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const headerEnd = normalized.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      return [];
    }

    const headerText = normalized.slice(0, headerEnd);
    const contentText = normalized.slice(headerEnd + 4).replace(/\r\n$/, "");
    const headers = headerText.split("\r\n");
    const disposition = headers.find((line) => /^content-disposition:/i.test(line));
    if (!disposition) {
      return [];
    }

    const nameMatch = /name="([^"]+)"/i.exec(disposition);
    if (!nameMatch) {
      return [];
    }

    const filenameMatch = /filename="([^"]*)"/i.exec(disposition);
    const contentTypeHeader = headers.find((line) => /^content-type:/i.test(line));

    return [
      {
        name: nameMatch[1],
        filename: filenameMatch?.[1] || undefined,
        contentType: contentTypeHeader?.split(":")[1]?.trim(),
        data: Buffer.from(contentText, "latin1"),
      },
    ];
  });
}

async function readCreateDocumentRequestBody(request: http.IncomingMessage): Promise<CreateDocumentRequestBody> {
  const contentType = request.headers["content-type"] ?? "";

  if (/multipart\/form-data/i.test(contentType)) {
    const raw = await readRequestBody(request);
    const parts = parseMultipartFormData(contentType, raw);
    const fieldMap = new Map<string, MultipartPart[]>();

    for (const part of parts) {
      const existing = fieldMap.get(part.name) ?? [];
      existing.push(part);
      fieldMap.set(part.name, existing);
    }

    const filePart = fieldMap.get("file")?.[0];
    const firstValue = (name: string) => fieldMap.get(name)?.[0]?.data.toString("utf8").trim();

    return {
      originalFilename: firstValue("originalFilename") || filePart?.filename,
      firstPageText: firstValue("firstPageText"),
      sourceText: firstValue("sourceText"),
      fileBase64: filePart ? filePart.data.toString("base64") : undefined,
      mimeType: firstValue("mimeType") ?? filePart?.contentType ?? null,
      title: firstValue("title") ?? null,
      source: firstValue("source") ?? null,
      recordingDate: firstValue("recordingDate") ?? null,
      receptionNumber: firstValue("receptionNumber") ?? null,
      bookPage: firstValue("bookPage") ?? null,
    };
  }

  return (await readJsonBody(request)) as CreateDocumentRequestBody;
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

      if (pathname === "/api/admin/document-backend-status" && request.method === "GET") {
        if (!isAuthorized(request)) {
          writeJson(response, 403, { error: "Forbidden" });
          return;
        }

        const config = loadDocumentBackendConfig();
        const storageHealth = await documentStorageService.healthCheck();
        writeJson(response, 200, {
          provider: config.provider,
          storePath: config.provider === "local" ? config.storePath : null,
          storageRoot: config.provider === "local" ? config.storageRoot : null,
          supabase: {
            urlConfigured: Boolean(config.supabaseUrl),
            serviceRoleKeyConfigured: Boolean(config.supabaseServiceRoleKey),
            bucket: config.supabaseStorageBucket,
          },
          storageHealth,
        });
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

      const projectExportMatch = matchRoute(pathname, /^\/api\/projects\/([^/]+)\/export\.json$/);
      if (projectExportMatch && request.method === "GET") {
        const [, projectId] = projectExportMatch;
        const exportPayload = await projectDocumentRepository.exportProjectData(projectId);
        writeJson(response, 200, exportPayload);
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
        const body = await readCreateDocumentRequestBody(request);
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

      const documentSourceMatch = matchRoute(pathname, /^\/api\/documents\/([^/]+)\/source-text$/);
      if (documentSourceMatch && request.method === "GET") {
        const [, documentId] = documentSourceMatch;
        const document = await projectDocumentRepository.getById(documentId);
        if (!document) {
          writeJson(response, 404, { error: "Document not found." });
          return;
        }

        const sourceText = (await projectDocumentRepository.getSourceText(documentId)) ?? (await documentStorageService.readDocumentText(document.storagePath));
        writeJson(response, 200, {
          documentId,
          storagePath: document.storagePath,
          sourceText,
        });
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
