import path from "node:path";

export type DocumentBackendProvider = "local" | "supabase";

export interface DocumentBackendConfig {
  provider: DocumentBackendProvider;
  storePath: string;
  storageRoot: string;
  supabaseUrl: string | null;
  supabaseServiceRoleKey: string | null;
  supabaseStorageBucket: string;
}

export function loadDocumentBackendConfig(env = process.env): DocumentBackendConfig {
  return {
    provider: (env.DOCUMENT_BACKEND_PROVIDER ?? "local") as DocumentBackendProvider,
    storePath: env.DOCUMENT_STORE_PATH ?? path.resolve(process.cwd(), "data", "project-documents.json"),
    storageRoot: env.DOCUMENT_STORAGE_ROOT ?? path.resolve(process.cwd(), "data", "storage"),
    supabaseUrl: env.SUPABASE_URL ?? null,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? null,
    supabaseStorageBucket: env.SUPABASE_STORAGE_BUCKET ?? "project-documents",
  };
}
