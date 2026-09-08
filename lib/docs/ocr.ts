// Browser-side OCR path (Phase 3): scanned PDFs and images.
//
// Requested behaviour: read a scan/photo, rebuild it as an EDITABLE Word
// document that mirrors the original, then translate that clean copy. We use
// tesseract.js (OCR, in the browser) to get text + word/line boxes, estimate
// relative font sizes from line heights (DPI-independent), infer paragraph
// alignment, and generate a .docx with the `docx` library.
//
// Honest limits (surfaced in the UI): this reconstructs editable text with
// approximate font SIZE, paragraph structure and alignment — not pixel-exact
// positions, the exact original typeface, or embedded logos/figures (those need
// image-region detection + font matching, a further enhancement). OCR can
// misread; always review. First OCR run downloads the engine + language data.

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  type ISectionOptions,
} from "docx";
import type { LoadedDoc } from "./types";

export interface OcrOptions {
  ocrLang?: string; // tesseract traineddata code(s), e.g. "eng" or "eng+fra"
  onProgress?: (fraction: number, label: string) => void;
}

// Map our display language names to tesseract language codes for OCR. Only a
// subset ship as easy single packs; default to English.
const TESS_LANG: Record<string, string> = {
  English: "eng",
  Spanish: "spa",
  French: "fra",
  German: "deu",
  Portuguese: "por",
  Italian: "ita",
  Dutch: "nld",
  Russian: "rus",
  Arabic: "ara",
  "Chinese (Simplified)": "chi_sim",
  "Chinese (Traditional)": "chi_tra",
  Japanese: "jpn",
  Korean: "kor",
  Hindi: "hin",
  Turkish: "tur",
  Polish: "pol",
  Ukrainian: "ukr",
  Vietnamese: "vie",
  Greek: "ell",
  Hebrew: "heb",
  Swedish: "swe",
  Romanian: "ron",
  Czech: "ces",
};

export function tesseractLangFor(sourceLanguageName: string | undefined): string {
  if (!sourceLanguageName || sourceLanguageName === "auto") return "eng";
  return TESS_LANG[sourceLanguageName] ?? "eng";
}

const MAX_OCR_PAGES = 20;

interface OcrPara {
  text: string;
  sizePt: number;
  align: "left" | "center" | "right";
}

// --- OCR result → paragraphs ------------------------------------------------
// tesseract v5 returns data.blocks -> paragraphs -> lines -> words, each with a
// bbox {x0,y0,x1,y1}. We derive relative font sizes from line heights so the
// result is independent of the scan's DPI.

interface TessBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface TessLine {
  bbox?: TessBBox;
}
interface TessPara {
  text?: string;
  bbox?: TessBBox;
  lines?: TessLine[];
}
interface TessBlock {
  paragraphs?: TessPara[];
}
interface TessData {
  text?: string;
  blocks?: TessBlock[] | null;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function ocrDataToParagraphs(data: TessData, pageWidth: number): OcrPara[] {
  const blocks = data.blocks ?? [];
  const paras: TessPara[] = [];
  for (const b of blocks) for (const p of b.paragraphs ?? []) paras.push(p);

  // Fallback when structured blocks aren't available: split plain text.
  if (paras.length === 0) {
    const chunks = (data.text ?? "")
      .split(/\n\s*\n/)
      .map((t) => t.replace(/\s+\n/g, " ").replace(/\n/g, " ").trim())
      .filter(Boolean);
    return chunks.map((text) => ({ text, sizePt: 11, align: "left" as const }));
  }

  // Body text size baseline = median line height across the page.
  const allLineHeights: number[] = [];
  for (const p of paras) {
    for (const l of p.lines ?? []) {
      if (l.bbox) allLineHeights.push(l.bbox.y1 - l.bbox.y0);
    }
  }
  const body = median(allLineHeights) || 12;

  const out: OcrPara[] = [];
  for (const p of paras) {
    const text = (p.text ?? "").replace(/\s+\n/g, " ").replace(/\n/g, " ").trim();
    if (!text) continue;
    const heights = (p.lines ?? [])
      .map((l) => (l.bbox ? l.bbox.y1 - l.bbox.y0 : 0))
      .filter((h) => h > 0);
    const h = heights.length ? median(heights) : body;
    const sizePt = Math.round(Math.min(40, Math.max(8, (h / body) * 11)));

    let align: "left" | "center" | "right" = "left";
    if (p.bbox && pageWidth > 0) {
      const leftGap = p.bbox.x0;
      const rightGap = pageWidth - p.bbox.x1;
      if (leftGap > pageWidth * 0.15 && Math.abs(leftGap - rightGap) < pageWidth * 0.12) {
        align = "center";
      }
    }
    out.push({ text, sizePt, align });
  }
  return out;
}

// --- DOCX assembly ----------------------------------------------------------
function alignConst(a: OcrPara["align"]) {
  return a === "center"
    ? AlignmentType.CENTER
    : a === "right"
      ? AlignmentType.RIGHT
      : AlignmentType.LEFT;
}

function buildDocxBlob(pages: OcrPara[][], textFor: (globalIndex: number) => string): Promise<Blob> {
  let idx = 0;
  const sections: ISectionOptions[] = pages.map((paras) => {
    const children = paras.map((p) => {
      const text = textFor(idx++);
      return new Paragraph({
        alignment: alignConst(p.align),
        spacing: { after: 120 },
        children: [new TextRun({ text, size: Math.round(p.sizePt * 2) })],
      });
    });
    if (children.length === 0) {
      children.push(new Paragraph({ children: [new TextRun("")] }));
    }
    return { children };
  });
  const doc = new Document({ sections });
  return Packer.toBlob(doc);
}

// --- Public loaders ---------------------------------------------------------
async function recognize(
  image: File | HTMLCanvasElement | string,
  lang: string,
  onProgress?: (f: number, label: string) => void
): Promise<TessData> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(lang, 1, {
    logger: (m: { status?: string; progress?: number }) => {
      if (onProgress && typeof m.progress === "number") {
        onProgress(m.progress, m.status ?? "recognizing text");
      }
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data as unknown as TessData;
  } finally {
    await worker.terminate();
  }
}

export async function loadImageOcr(file: File, opts: OcrOptions): Promise<LoadedDoc> {
  const lang = opts.ocrLang ?? "eng";
  // Natural width for alignment inference.
  const bitmap = await createImageBitmap(file).catch(() => null);
  const pageWidth = bitmap?.width ?? 0;
  bitmap?.close?.();

  const data = await recognize(file, lang, opts.onProgress);
  const paras = ocrDataToParagraphs(data, pageWidth);
  if (paras.length === 0) {
    throw new Error("OCR found no readable text in this image.");
  }
  const segments = paras.map((p) => p.text);
  const build = (translations: string[]) =>
    buildDocxBlob([paras], (i) => translations[i] ?? segments[i]);
  return { kind: "image", segments, pageEstimate: 1, build, outputExt: "docx", ocr: true };
}

// Render scanned PDF pages to canvases and OCR each. `buffer` is the PDF bytes.
export async function loadScannedPdfOcr(buffer: ArrayBuffer, opts: OcrOptions): Promise<LoadedDoc> {
  const lang = opts.ocrLang ?? "eng";
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pageCount = Math.min(doc.numPages, MAX_OCR_PAGES);
  const pages: OcrPara[][] = [];

  for (let p = 1; p <= pageCount; p++) {
    const page = await doc.getPage(p);
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't create a canvas for OCR.");
    await page.render({ canvasContext: ctx, viewport }).promise;

    const overall = (frac: number, label: string) =>
      opts.onProgress?.((p - 1 + frac) / pageCount, `Page ${p}/${pageCount}: ${label}`);
    const data = await recognize(canvas, lang, overall);
    pages.push(ocrDataToParagraphs(data, canvas.width));
  }
  await doc.destroy();

  const flat: OcrPara[] = pages.flat();
  if (flat.length === 0) {
    throw new Error("OCR found no readable text in this PDF.");
  }
  const segments = flat.map((p) => p.text);
  const build = (translations: string[]) =>
    buildDocxBlob(pages, (i) => translations[i] ?? segments[i]);
  return { kind: "pdf", segments, pageEstimate: pageCount, build, outputExt: "docx", ocr: true };
}
