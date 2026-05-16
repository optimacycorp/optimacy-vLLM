import { z } from "zod";

export const easementSchema = z.object({
  documentType: z.literal("easement"),
  grantor: z.array(z.string()),
  grantee: z.array(z.string()),
  recordingDate: z.string().nullable(),
  receptionNumber: z.string().nullable(),
  easementPurpose: z.string().nullable(),
  width: z.string().nullable(),
  locationDescription: z.string().nullable(),
  burdenedProperty: z.string().nullable(),
  benefitedProperty: z.string().nullable(),
  maintenanceRights: z.string().nullable(),
  accessRights: z.string().nullable(),
  legalDescription: z.string().nullable(),
  surveyRelevance: z.enum(["low", "medium", "high"]),
  warnings: z.array(z.string()),
});
