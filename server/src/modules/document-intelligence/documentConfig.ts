import path from "node:path";

export function getDocumentStorageRoot(env = process.env): string {
  return env.DOCUMENT_STORAGE_ROOT ?? path.resolve(process.cwd(), "data", "storage");
}
