import { createProjectDocumentRepository } from "./modules/document-intelligence/documentRepository.js";
import { DocumentPipelineService } from "./modules/document-intelligence/documentPipelineService.js";

async function runWorkerLoop() {
  const repository = createProjectDocumentRepository();
  const pipeline = new DocumentPipelineService(repository);
  const intervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);

  console.log(`Waymail worker started with poll interval ${intervalMs}ms`);

  const tick = async () => {
    try {
      const results = await pipeline.processPendingDocumentsOnce();
      if (results.length > 0) {
        console.log("Processed document batch", results);
      }
    } catch (error) {
      console.error("Worker tick failed", error);
    }
  };

  await tick();
  setInterval(() => {
    void tick();
  }, intervalMs);
}

void runWorkerLoop();
