import { z } from "zod";

export const titleCommitmentRequirementSchema = z.object({
  number: z.string().nullable(),
  text: z.string(),
  parties: z.array(z.string()),
  recordingReference: z.string().nullable(),
  surveyRelevance: z.enum(["low", "medium", "high"]),
});

export const titleCommitmentExceptionSchema = z.object({
  number: z.string().nullable(),
  text: z.string(),
  exceptionType: z.enum([
    "tax",
    "easement",
    "covenant",
    "mineral",
    "access",
    "utility",
    "water",
    "ditch",
    "survey",
    "other",
  ]),
  recordingReference: z.string().nullable(),
  affectsSurvey: z.boolean(),
  reason: z.string(),
});

export const titleCommitmentSchema = z.object({
  commitmentNumber: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  issueDate: z.string().nullable(),
  proposedInsured: z.string().nullable(),
  estateOrInterest: z.string().nullable(),
  vestedOwner: z.string().nullable(),
  landDescription: z.string().nullable(),
  requirements: z.array(titleCommitmentRequirementSchema),
  exceptions: z.array(titleCommitmentExceptionSchema),
  warnings: z.array(z.string()),
});
