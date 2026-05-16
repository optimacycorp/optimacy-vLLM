import { z } from "zod";

export const documentQaSchema = z.object({
  answer: z.string(),
  warnings: z.array(z.string()),
  citations: z.array(
    z.object({
      chunkId: z.string(),
      claim: z.string(),
    }),
  ),
});
