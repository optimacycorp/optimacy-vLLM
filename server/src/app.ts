import http from "node:http";

const port = Number(process.env.PORT ?? 3000);

const startupPage = `<!doctype html>
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
      max-width: 860px;
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
  </style>
</head>
<body>
  <main>
    <section class="card">
      <p class="eyebrow">Optimacy Geomatics Services LLC</p>
      <h1>Colorado geomatics support with a live deployment foothold.</h1>
      <p>This RackNerd instance is now serving the startup page for the Optimacy portal. The document-intelligence API and provider switching work are being wired in next.</p>
      <p>When you can see this page on waymail.net, Nginx to Node proxying is healthy and the server runtime is up.</p>
      <span class="status">Startup service online on port ${port}</span>
      <div class="grid">
        <div class="tile">
          <strong>Current mode</strong>
          <span>${process.env.LLM_PROVIDER ?? "mock"}</span>
        </div>
        <div class="tile">
          <strong>Health endpoint</strong>
          <span><code>/health</code></span>
        </div>
        <div class="tile">
          <strong>Next sprint</strong>
          <span>Provider switch, admin AI settings, upload pipeline</span>
        </div>
      </div>
    </section>
  </main>
</body>
</html>`;

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(
      JSON.stringify({
        status: "ok",
        service: "waymail-portal",
        port,
        llmProvider: process.env.LLM_PROVIDER ?? "mock",
      }),
    );
    return;
  }

  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(startupPage);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Waymail portal listening on http://0.0.0.0:${port}`);
});
