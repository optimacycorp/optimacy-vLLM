import { z } from "zod";

export const deedSchema = z.object({
  documentType: z.literal("deed"),
  deedType: z.string().nullable(),
  grantor: z.array(z.string()),
  grantee: z.array(z.string()),
  recordingDate: z.string().nullable(),
  executionDate: z.string().nullable(),
  receptionNumber: z.string().nullable(),
  bookPage: z.string().nullable(),
  consideration: z.string().nullable(),
  legalDescription: z.string().nullable(),
  reservations: z.array(z.string()),
  exceptions: z.array(z.string()),
  warnings: z.array(z.string()),
});
