import type { LoadedDoc } from "./types";
import { loadOffice, isSupportedOffice } from "./office";
import { loadPdf } from "./pdf";

export type { LoadedDoc, DocKind } from "./types";
export { pdfSupportsLanguage, PDF_TARGET_LANGUAGES } from "./pdf";

function isPdf(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

export function isSupportedDoc(name: string): boolean {
  return isSupportedOffice(name) || isPdf(name);
}

export function docKindLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".docx")) return "Word";
  if (lower.endsWith(".pptx")) return "PowerPoint";
  if (lower.endsWith(".xlsx")) return "Excel";
  if (lower.endsWith(".pdf")) return "PDF";
  return "document";
}

// Load any supported document into the uniform pipeline shape.
export async function loadDocument(file: File): Promise<LoadedDoc> {
  if (isPdf(file.name)) return loadPdf(file);
  if (isSupportedOffice(file.name)) return loadOffice(file);
  throw new Error("Unsupported file. Use .docx, .pptx, .xlsx or .pdf.");
}
