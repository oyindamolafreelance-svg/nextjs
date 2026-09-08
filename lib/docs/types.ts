// Shared shape for every document the translator can load, so the UI can drive
// Office files and PDFs through one uniform pipeline: pull a flat list of text
// segments, translate them, then rebuild the file with translations applied in
// the same order.

export type DocKind = "docx" | "pptx" | "xlsx" | "pdf";

export interface LoadedDoc {
  kind: DocKind;
  segments: string[]; // source text, in document order
  pageEstimate: number;
  build: (translations: string[]) => Promise<Blob>;
}
