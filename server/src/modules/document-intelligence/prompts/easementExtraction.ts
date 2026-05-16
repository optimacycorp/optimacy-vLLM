export const easementExtractionPrompt = `
Extract easement details as JSON only.

Rules:
- Preserve recording references exactly.
- Describe the burdened and benefited properties from the source text only.
- If survey relevance is uncertain, choose the lowest defensible level and explain in warnings.
`.trim();
