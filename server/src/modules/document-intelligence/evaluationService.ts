import type { DocumentChunk, DocumentEvalCase, EvalRunSummary } from "./types.js";
import { DocumentQaService } from "./documentQaService.js";

export class EvaluationService {
  constructor(private readonly qaService: DocumentQaService) {}

  async runCases(projectId: string, cases: DocumentEvalCase[], chunks: DocumentChunk[]): Promise<EvalRunSummary[]> {
    const summaries: EvalRunSummary[] = [];

    for (const evalCase of cases) {
      const response = await this.qaService.answerQuestion(
        {
          projectId,
          question: evalCase.question,
        },
        chunks,
      );

      const pass =
        evalCase.expectedAnswer == null
          ? null
          : response.answer.toLowerCase().includes(evalCase.expectedAnswer.toLowerCase());

      summaries.push({
        caseId: evalCase.id,
        question: evalCase.question,
        answer: response.answer,
        citedChunkIds: response.citations.map((citation) => citation.chunkId),
        pass,
        notes: pass === false ? "Expected answer substring was not found in response." : null,
      });
    }

    return summaries;
  }
}
