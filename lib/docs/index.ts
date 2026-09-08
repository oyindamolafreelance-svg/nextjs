import type { LoadedDoc } from "./types";
import { loadOffice, isSupportedOffice } from "./office";
import { loadPdf } from "./pdf";
import { loadImageOcr, loadScannedPdfOcr, tesseractLangFor, type OcrOptions } from "./ocr";

export type { LoadedDoc, DocKind } from "./types";
export { pdfSupportsLanguage, PDF_TARGET_LANGUAGES } from "./pdf";
export { tesseractLangFor } from "./ocr";

function isPdf(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

function isImage(name: string): boolean {
  return /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(name);
}

export function isSupportedDoc(name: string): boolean {
  return isSupportedOffice(name) || isPdf(name) || isImage(name);
}

export function docKindLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".docx")) return "Word";
  if (lower.endsWith(".pptx")) return "PowerPoint";
  if (lower.endsWith(".xlsx")) return "Excel";
  if (lower.endsWith(".pdf")) return "PDF";
  if (isImage(lower)) return "image";
  return "document";
}

export interface LoadOptions {
  // Source language the user picked ("auto" or a display name) — used to select
  // the OCR language pack for scans.
  sourceLang?: string;
  onOcrProgress?: (fraction: number, label: string) => void;
}

// Load any supported document into the uniform pipeline shape. Scanned PDFs
// (no text layer) and images fall back to the OCR path, which rebuilds an
// editable .docx.
export async function loadDocument(file: File, opts: LoadOptions = {}): Promise<LoadedDoc> {
  const ocrOpts: OcrOptions = {
    ocrLang: tesseractLangFor(opts.sourceLang),
    onProgress: opts.onOcrProgress,
  };

  if (isImage(file.name)) {
    return loadImageOcr(file, ocrOpts);
  }
  if (isPdf(file.name)) {
    const digital = await loadPdf(file);
    if (digital.segments.length > 0) return digital;
    // No text layer → scanned PDF → OCR path.
    return loadScannedPdfOcr(await file.arrayBuffer(), ocrOpts);
  }
  if (isSupportedOffice(file.name)) {
    return loadOffice(file);
  }
  throw new Error("Unsupported file. Use .docx, .pptx, .xlsx, .pdf or an image.");
}
