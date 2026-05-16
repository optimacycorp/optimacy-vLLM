export const deedExtractionPrompt = `
Extract deed metadata as JSON only.

Rules:
- Preserve parties, recording references, and legal description text exactly when available.
- Missing fields must be null.
- Put ambiguities in warnings.
`.trim();
