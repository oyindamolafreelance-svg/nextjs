// Shared shape for every document the translator can load, so the UI can drive
// Office files and PDFs through one uniform pipeline: pull a flat list of text
// segments, translate them, then rebuild the file with translations applied in
// the same order.

export type DocKind = "docx" | "pptx" | "xlsx" | "pdf" | "image";

export interface LoadedDoc {
  kind: DocKind;
  segments: string[]; // source text, in document order
  pageEstimate: number;
  build: (translations: string[]) => Promise<Blob>;
  // Output file extension when it differs from the input (e.g. a scanned PDF or
  // image is reconstructed as an editable .docx). Defaults to the input's ext.
  outputExt?: string;
  // True when the text came from OCR (machine reading of a scan) — the UI warns
  // that a human should verify it.
  ocr?: boolean;
}
