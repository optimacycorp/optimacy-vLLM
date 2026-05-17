import type { LlmClient } from "../llm/types.js";
import { DocumentQaService } from "./documentQaService.js";
import type { ProjectDocumentRepository } from "./documentRepository.js";
import type { QaRequest, QaResponse } from "./types.js";

export class ProjectQaService {
  private readonly qaService: DocumentQaService;

  constructor(
    private readonly repository: ProjectDocumentRepository,
    llmClient: LlmClient,
    qaService = new DocumentQaService(llmClient),
  ) {
    this.qaService = qaService;
  }

  async answerQuestion(request: QaRequest): Promise<QaResponse> {
    const chunks = await this.repository.listChunksByProjectId(request.projectId);
    const response = await this.qaService.answerQuestion(request, chunks);

    await this.repository.createQaRun({
      projectId: request.projectId,
      question: request.question,
      answer: response.answer,
      citedChunkIds: response.citations.map((citation) => citation.chunkId),
      modelName: response.modelName,
      retrievalK: request.topK ?? 8,
      promptTokens: null,
      completionTokens: null,
      latencyMs: response.latencyMs,
    });

    return response;
  }
}
