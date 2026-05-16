export const titleCommitmentExtractionPrompt = `
Extract structured title commitment data as JSON only.

Rules:
- Never invent missing recording references.
- Preserve reception numbers exactly when present.
- Flag easements, ditches, rights-of-way, access, utilities, water rights, and survey matters.
- Missing fields must be null.
- Include uncertainty in warnings.
`.trim();
