import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type http from "node:http";
import { createAppServer } from "./app.js";

let server: http.Server;
let baseUrl: string;

describe("app server", () => {
  beforeAll(async () => {
    process.env.LLM_PROVIDER = "mock";
    process.env.EMBEDDING_PROVIDER = "mock";
    process.env.ENABLE_AI_EXTRACTION = "false";
    process.env.ENABLE_RAG_QA = "true";
    server = createAppServer();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected a TCP server address");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns runtime AI settings", async () => {
    const response = await fetch(`${baseUrl}/api/admin/ai-settings`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.llmProvider).toBe("mock");
    expect(body.embeddingProvider).toBe("mock");
  });

  it("runs the admin AI settings test route in mock mode", async () => {
    const response = await fetch(`${baseUrl}/api/admin/ai-settings/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Return JSON with status ok" }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.provider).toBe("mock");
    expect(body.jsonValid).toBe(true);
  });
});
