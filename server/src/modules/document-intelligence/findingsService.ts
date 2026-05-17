import { randomUUID } from "node:crypto";
import type { ProjectDocumentRepository } from "./documentRepository.js";
import type {
  DocumentAiFindingRecord,
  DocumentChunk,
  DocumentExtractionRecord,
  ProjectDocument,
} from "./types.js";

export class FindingsService {
  constructor(private readonly repository: ProjectDocumentRepository) {}

  async generateForDocument(documentId: string): Promise<DocumentAiFindingRecord[] | null> {
    const document = await this.repository.getById(documentId);
    if (!document) {
      return null;
    }

    const [extractions, warnings, chunks] = await Promise.all([
      this.repository.listExtractionsByDocumentId(documentId),
      this.repository.getProcessingWarnings(documentId),
      this.repository.listChunks(documentId),
    ]);

    const findings = [
      ...this.buildWarningFindings(document, warnings),
      ...this.buildExtractionFindings(document, extractions, chunks),
    ];

    await this.repository.replaceFindingsForDocument(documentId, findings);
    return findings;
  }

  private buildWarningFindings(document: ProjectDocument, warnings: string[]): DocumentAiFindingRecord[] {
    if (warnings.length === 0) {
      return [];
    }

    return warnings.map((warning) => ({
      id: randomUUID(),
      projectId: document.projectId,
      documentId: document.id,
      findingType: "document_quality_problem",
      severity: "medium",
      title: "Document quality issue detected",
      explanation: warning,
      supportingChunkIds: [],
      status: "open",
      createdAt: new Date().toISOString(),
    }));
  }

  private buildExtractionFindings(
    document: ProjectDocument,
    extractions: DocumentExtractionRecord[],
    chunks: DocumentChunk[],
  ): DocumentAiFindingRecord[] {
    const latestByType = new Map<string, DocumentExtractionRecord>();
    for (const extraction of extractions) {
      if (!latestByType.has(extraction.extractionType)) {
        latestByType.set(extraction.extractionType, extraction);
      }
    }

    const findings: DocumentAiFindingRecord[] = [];
    const documentChunkIds = chunks.map((chunk) => chunk.id);

    const titleCommitment = latestByType.get("title_commitment")?.extractedJson as
      | {
          landDescription?: string | null;
          requirements?: Array<{ surveyRelevance?: string; text?: string }>;
          exceptions?: Array<{ exceptionType?: string; affectsSurvey?: boolean; text?: string }>;
        }
      | undefined;

    if (titleCommitment) {
      if (!titleCommitment.landDescription) {
        findings.push(this.makeFinding(document, "missing_legal_description", "high", "Missing legal description", "The title commitment extraction did not produce a legal description.", documentChunkIds));
      }

      for (const requirement of titleCommitment.requirements ?? []) {
        if (requirement.surveyRelevance === "high") {
          findings.push(
            this.makeFinding(
              document,
              "title_requirement",
              "medium",
              "Survey-relevant title requirement",
              requirement.text ?? "A survey-relevant title requirement was detected.",
              documentChunkIds,
            ),
          );
        }
      }

      for (const exception of titleCommitment.exceptions ?? []) {
        if (!exception.affectsSurvey) {
          continue;
        }

        const mappedType = this.mapExceptionTypeToFindingType(exception.exceptionType ?? "other");
        const severity = ["utility", "access", "water", "ditch", "survey"].includes(exception.exceptionType ?? "") ? "high" : "medium";
        findings.push(
          this.makeFinding(
            document,
            mappedType,
            severity,
            "Survey-relevant exception detected",
            exception.text ?? "A survey-relevant title exception was detected.",
            documentChunkIds,
          ),
        );
      }
    }

    const deed = latestByType.get("deed")?.extractedJson as
      | {
          legalDescription?: string | null;
          reservations?: string[];
          exceptions?: string[];
        }
      | undefined;

    if (deed) {
      if (!deed.legalDescription) {
        findings.push(this.makeFinding(document, "missing_legal_description", "high", "Missing legal description", "The deed extraction did not produce a legal description.", documentChunkIds));
      }
      if ((deed.reservations ?? []).length > 0 || (deed.exceptions ?? []).length > 0) {
        findings.push(
          this.makeFinding(
            document,
            "title_requirement",
            "medium",
            "Reservations or exceptions detected",
            "The deed extraction contains reservations or exceptions that should be reviewed.",
            documentChunkIds,
          ),
        );
      }
    }

    const easement = latestByType.get("easement")?.extractedJson as
      | {
          surveyRelevance?: string;
          easementPurpose?: string | null;
          legalDescription?: string | null;
          accessRights?: string | null;
          maintenanceRights?: string | null;
        }
      | undefined;

    if (easement) {
      if (!easement.legalDescription) {
        findings.push(this.makeFinding(document, "missing_legal_description", "high", "Missing legal description", "The easement extraction did not produce a legal description.", documentChunkIds));
      }

      if (easement.surveyRelevance === "high") {
        findings.push(
          this.makeFinding(
            document,
            "easement_affects_build_area",
            "high",
            "High-relevance easement detected",
            easement.easementPurpose ?? "A high-relevance easement was detected and may affect survey review.",
            documentChunkIds,
          ),
        );
      }

      if (easement.accessRights) {
        findings.push(
          this.makeFinding(document, "access_issue", "medium", "Access rights referenced", easement.accessRights, documentChunkIds),
        );
      }
      if (easement.maintenanceRights) {
        findings.push(
          this.makeFinding(document, "utility_easement", "medium", "Maintenance rights referenced", easement.maintenanceRights, documentChunkIds),
        );
      }
    }

    return this.dedupeFindings(findings);
  }

  private mapExceptionTypeToFindingType(exceptionType: string): string {
    switch (exceptionType) {
      case "utility":
        return "utility_easement";
      case "ditch":
      case "water":
        return "ditch_or_water_right";
      case "access":
        return "access_issue";
      case "survey":
        return "survey_exception";
      case "mineral":
        return "mineral_exception";
      default:
        return "title_requirement";
    }
  }

  private makeFinding(
    document: ProjectDocument,
    findingType: string,
    severity: DocumentAiFindingRecord["severity"],
    title: string,
    explanation: string,
    supportingChunkIds: string[],
  ): DocumentAiFindingRecord {
    return {
      id: randomUUID(),
      projectId: document.projectId,
      documentId: document.id,
      findingType,
      severity,
      title,
      explanation,
      supportingChunkIds,
      status: "open",
      createdAt: new Date().toISOString(),
    };
  }

  private dedupeFindings(findings: DocumentAiFindingRecord[]): DocumentAiFindingRecord[] {
    const seen = new Set<string>();
    return findings.filter((finding) => {
      const key = `${finding.documentId}:${finding.findingType}:${finding.title}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
