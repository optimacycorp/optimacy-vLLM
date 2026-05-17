import { createLlmClient } from "../llm/llmClient.js";
import { loadLlmConfig } from "../llm/llmConfig.js";
import type { LlmRuntimeConfig } from "../llm/types.js";
import { DocumentChunkingService } from "./documentChunkingService.js";
import { DocumentExtractionService } from "./documentExtractionService.js";
import { DocumentIngestionService } from "./documentIngestionService.js";
import { DocumentParsingService } from "./documentParsingService.js";
import { DocumentQaService } from "./documentQaService.js";
import { DocumentRetrievalService } from "./documentRetrievalService.js";
import { EvaluationService } from "./evaluationService.js";

export * from "./documentChunkingService.js";
export * from "./documentExtractionService.js";
export * from "./documentIngestionService.js";
export * from "./documentPipelineService.js";
export * from "./documentParsingService.js";
export * from "./projectQaService.js";
export * from "./documentQaService.js";
export * from "./documentRepository.js";
export * from "./documentRetrievalService.js";
export * from "./evaluationService.js";
export * from "./schemas/deedSchema.js";
export * from "./schemas/documentQaSchema.js";
export * from "./schemas/easementSchema.js";
export * from "./schemas/titleCommitmentSchema.js";
export * from "./types.js";

export function createDocumentIntelligenceModule(config: LlmRuntimeConfig = loadLlmConfig()) {
  const llmClient = createLlmClient(config);
  const ingestionService = new DocumentIngestionService();
  const parsingService = new DocumentParsingService();
  const chunkingService = new DocumentChunkingService();
  const retrievalService = new DocumentRetrievalService();
  const extractionService = new DocumentExtractionService(llmClient);
  const qaService = new DocumentQaService(llmClient, retrievalService);
  const evaluationService = new EvaluationService(qaService);

  return {
    llmClient,
    ingestionService,
    parsingService,
    chunkingService,
    retrievalService,
    extractionService,
    qaService,
    evaluationService,
  };
}
