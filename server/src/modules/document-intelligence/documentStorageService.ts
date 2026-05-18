import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadDocumentBackendConfig } from "./documentBackendConfig.js";
import { SupabaseRestClient } from "./supabaseClient.js";

interface SaveDocumentInput {
  projectId: string;
  originalFilename: string;
  sourceText?: string;
  fileBase64?: string;
  mimeType?: string | null;
}

export interface StoredDocumentResult {
  storagePath: string;
  sourceText: string | null;
}

export interface DocumentStorageHealthStatus {
  provider: "local" | "supabase";
  ok: boolean;
  storageTarget: string;
  readable: boolean;
  writable: boolean;
  details: string[];
}

export interface DocumentStorageService {
  saveDocument(input: SaveDocumentInput): Promise<StoredDocumentResult>;
  readDocumentText(storagePath: string): Promise<string | null>;
  healthCheck(): Promise<DocumentStorageHealthStatus>;
}

export class LocalDocumentStorageService implements DocumentStorageService {
  constructor(private readonly storageRoot: string) {}

  async saveDocument(input: SaveDocumentInput): Promise<StoredDocumentResult> {
    const extension = path.extname(input.originalFilename) || this.defaultExtension(input.mimeType);
    const baseName = this.sanitizeFilename(path.basename(input.originalFilename, extension));
    const storedFilename = `${Date.now()}-${randomUUID()}-${baseName}${extension}`;
    const projectDir = path.join(this.storageRoot, input.projectId);
    const absolutePath = path.join(projectDir, storedFilename);

    await mkdir(projectDir, { recursive: true });

    if (input.fileBase64) {
      const buffer = Buffer.from(input.fileBase64, "base64");
      await writeFile(absolutePath, buffer);
      return {
        storagePath: path.join(input.projectId, storedFilename).replace(/\\/g, "/"),
        sourceText: this.tryDecodeText(buffer, input.mimeType),
      };
    }

    const sourceText = input.sourceText ?? "";
    await writeFile(absolutePath, sourceText, "utf8");
    return {
      storagePath: path.join(input.projectId, storedFilename).replace(/\\/g, "/"),
      sourceText,
    };
  }

  async readDocumentText(storagePath: string): Promise<string | null> {
    try {
      const absolutePath = path.join(this.storageRoot, storagePath);
      return await readFile(absolutePath, "utf8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async healthCheck(): Promise<DocumentStorageHealthStatus> {
    const healthDir = path.join(this.storageRoot, "__healthcheck__");
    const healthFile = path.join(healthDir, `${randomUUID()}.txt`);
    const payload = "optimacy-document-storage-healthcheck";

    try {
      await mkdir(healthDir, { recursive: true });
      await writeFile(healthFile, payload, "utf8");
      const roundTrip = await readFile(healthFile, "utf8");
      await rm(healthFile, { force: true });

      return {
        provider: "local",
        ok: roundTrip === payload,
        storageTarget: this.storageRoot,
        readable: roundTrip === payload,
        writable: true,
        details: [`Local storage root verified at ${this.storageRoot}.`],
      };
    } catch (error) {
      return {
        provider: "local",
        ok: false,
        storageTarget: this.storageRoot,
        readable: false,
        writable: false,
        details: [error instanceof Error ? error.message : "Local storage health check failed."],
      };
    }
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "document";
  }

  private defaultExtension(mimeType?: string | null): string {
    if (mimeType === "application/json") {
      return ".json";
    }
    if (mimeType?.startsWith("text/")) {
      return ".txt";
    }
    return ".bin";
  }

  private tryDecodeText(buffer: Buffer, mimeType?: string | null): string | null {
    if (mimeType?.startsWith("text/") || mimeType === "application/json" || mimeType == null) {
      return buffer.toString("utf8");
    }
    return null;
  }
}

export class SupabaseDocumentStorageService implements DocumentStorageService {
  constructor(
    private readonly client: SupabaseRestClient,
    private readonly bucket: string,
  ) {}

  async saveDocument(input: SaveDocumentInput): Promise<StoredDocumentResult> {
    const extension = path.extname(input.originalFilename) || this.defaultExtension(input.mimeType);
    const baseName = this.sanitizeFilename(path.basename(input.originalFilename, extension));
    const objectPath = `${input.projectId}/${Date.now()}-${randomUUID()}-${baseName}${extension}`.replace(/\\/g, "/");

    if (input.fileBase64) {
      const buffer = Buffer.from(input.fileBase64, "base64");
      await this.client.uploadObject(this.bucket, objectPath, buffer, input.mimeType ?? "application/octet-stream");
      return {
        storagePath: objectPath,
        sourceText: this.tryDecodeText(buffer, input.mimeType),
      };
    }

    const sourceText = input.sourceText ?? "";
    await this.client.uploadObject(this.bucket, objectPath, sourceText, input.mimeType ?? "text/plain; charset=utf-8");
    return {
      storagePath: objectPath,
      sourceText,
    };
  }

  async readDocumentText(storagePath: string): Promise<string | null> {
    return await this.client.downloadObject(this.bucket, storagePath);
  }

  async healthCheck(): Promise<DocumentStorageHealthStatus> {
    const probePath = `__healthcheck__/${randomUUID()}.txt`;

    try {
      await this.client.uploadObject(this.bucket, probePath, "optimacy-document-storage-healthcheck", "text/plain; charset=utf-8");
      const roundTrip = await this.client.downloadObject(this.bucket, probePath);

      return {
        provider: "supabase",
        ok: roundTrip === "optimacy-document-storage-healthcheck",
        storageTarget: this.bucket,
        readable: roundTrip === "optimacy-document-storage-healthcheck",
        writable: true,
        details: [`Supabase storage bucket verified: ${this.bucket}.`],
      };
    } catch (error) {
      return {
        provider: "supabase",
        ok: false,
        storageTarget: this.bucket,
        readable: false,
        writable: false,
        details: [error instanceof Error ? error.message : "Supabase storage health check failed."],
      };
    }
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "document";
  }

  private defaultExtension(mimeType?: string | null): string {
    if (mimeType === "application/json") {
      return ".json";
    }
    if (mimeType?.startsWith("text/")) {
      return ".txt";
    }
    return ".bin";
  }

  private tryDecodeText(buffer: Buffer, mimeType?: string | null): string | null {
    if (mimeType?.startsWith("text/") || mimeType === "application/json" || mimeType == null) {
      return buffer.toString("utf8");
    }
    return null;
  }
}

export function createDocumentStorageService(): DocumentStorageService {
  const config = loadDocumentBackendConfig();
  if (config.provider === "supabase") {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when DOCUMENT_BACKEND_PROVIDER=supabase");
    }
    return new SupabaseDocumentStorageService(
      new SupabaseRestClient(config.supabaseUrl, config.supabaseServiceRoleKey),
      config.supabaseStorageBucket,
    );
  }

  return new LocalDocumentStorageService(config.storageRoot);
}
