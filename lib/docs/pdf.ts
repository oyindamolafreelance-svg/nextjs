// Browser-side digital-PDF translation (Phase 2).
//
// "Digital" = a PDF whose text is real, selectable text (exported from Word,
// LaTeX, a web page, etc.), not a scan. We extract each text line with its
// position using pdf.js, translate line-by-line, then use pdf-lib to cover the
// original line with a white box and draw the translation in the same place —
// so logos, images, rules and overall layout are preserved.
//
// Honest limits of the free approach (surfaced in the UI):
//   * Western-European targets use PDF standard fonts; other scripts (Chinese,
//     Japanese, Korean, Cyrillic, Greek, Arabic, …) embed a Noto font fetched
//     at runtime (see fonts.ts). A language with neither is still unsupported.
//   * The cover box is white, so results are cleanest on white-background PDFs.
//   * Scanned PDFs have no text layer — those are Phase 3 (OCR).

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { LoadedDoc } from "./types";
import { loadFontBytes, needsUnicodeFont, pdfLanguageSupported } from "./fonts";

export function pdfSupportsLanguage(name: string): boolean {
  return pdfLanguageSupported(name);
}

interface Line {
  text: string;
  x: number; // left, PDF user space (origin bottom-left)
  y: number; // baseline
  width: number;
  fontSize: number;
  page: number; // 0-based
}

interface RawItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Cluster text items on a page into visual lines (same baseline), left→right.
export function groupItemsIntoLines(items: RawItem[], page: number): Line[] {
  const usable = items.filter((it) => it.str && it.str.trim() !== "");
  if (usable.length === 0) return [];
  // Sort top→bottom (larger y first), then left→right.
  usable.sort((a, b) => (Math.abs(b.y - a.y) > 1 ? b.y - a.y : a.x - b.x));

  const lines: Line[] = [];
  let current: RawItem[] = [];
  let currentY = usable[0].y;
  const tol = Math.max(2, (usable[0].height || 10) * 0.6);

  const flush = () => {
    if (current.length === 0) return;
    current.sort((a, b) => a.x - b.x);
    let text = "";
    let prevEnd = current[0].x;
    for (const it of current) {
      const gap = it.x - prevEnd;
      if (text && gap > (it.height || 10) * 0.25) text += " ";
      text += it.str;
      prevEnd = it.x + it.width;
    }
    const x = current[0].x;
    const width = prevEnd - x;
    const fontSize = Math.max(...current.map((c) => c.height || 10));
    lines.push({ text: text.trim(), x, y: currentY, width, fontSize, page });
    current = [];
  };

  for (const it of usable) {
    if (Math.abs(it.y - currentY) <= tol) {
      current.push(it);
    } else {
      flush();
      current = [it];
      currentY = it.y;
    }
  }
  flush();
  return lines.filter((l) => l.text !== "");
}

// Map typographic characters to WinAnsi-safe equivalents, then drop anything
// the standard font still can't encode (so drawing never throws).
function sanitizeForStandardFont(text: string, font: PDFFont): string {
  const mapped = text
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ");
  let out = "";
  for (const ch of mapped) {
    try {
      font.widthOfTextAtSize(ch, 12);
      out += ch;
    } catch {
      out += ch.charCodeAt(0) < 128 ? ch : "";
    }
  }
  return out;
}

async function extractLines(buffer: ArrayBuffer): Promise<{ lines: Line[]; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist");
  // Bundle the worker locally (no external fetch — CSP/egress safe).
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const lines: Line[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: RawItem[] = [];
    for (const item of content.items) {
      // TextItem has str, transform [a,b,c,d,e,f], width, height.
      const it = item as { str?: string; transform?: number[]; width?: number; height?: number };
      if (typeof it.str !== "string") continue;
      const t = it.transform ?? [1, 0, 0, 1, 0, 0];
      const fontSize = Math.hypot(t[2], t[3]) || it.height || 10;
      items.push({
        str: it.str,
        x: t[4],
        y: t[5],
        width: it.width ?? 0,
        height: fontSize,
      });
    }
    lines.push(...groupItemsIntoLines(items, p - 1));
  }
  const pageCount = doc.numPages;
  await doc.destroy();
  return { lines, pageCount };
}

export async function loadPdf(file: File, targetLang?: string): Promise<LoadedDoc> {
  const buffer = await file.arrayBuffer();
  // pdf.js detaches the ArrayBuffer it's given; keep a copy for pdf-lib.
  const forExtract = buffer.slice(0);
  const { lines, pageCount } = await extractLines(forExtract);

  const segments = lines.map((l) => l.text);

  const build = async (translations: string[]): Promise<Blob> => {
    if (translations.length !== lines.length) {
      throw new Error("Translation count did not match the PDF. Please retry.");
    }
    const pdfDoc = await PDFDocument.load(buffer.slice(0));

    // Pick the font: standard (WinAnsi) for Western targets, or an embedded
    // Noto font for scripts the standard font can't render (Chinese, etc.).
    let font: PDFFont;
    let unicode = false;
    if (targetLang && needsUnicodeFont(targetLang)) {
      const fontBytes = await loadFontBytes(targetLang);
      if (fontBytes) {
        pdfDoc.registerFontkit(fontkit);
        try {
          font = await pdfDoc.embedFont(fontBytes, { subset: true });
        } catch {
          // Subsetting can fail on some CJK builds — embed the whole font.
          font = await pdfDoc.embedFont(fontBytes);
        }
        unicode = true;
      } else {
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }
    } else {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }
    const pages = pdfDoc.getPages();

    lines.forEach((line, i) => {
      const page = pages[line.page];
      if (!page) return;
      const raw = translations[i] ?? line.text;
      const translated = unicode ? raw : sanitizeForStandardFont(raw, font);
      if (!translated.trim()) return;

      // Cover the original line.
      page.drawRectangle({
        x: line.x - 1,
        y: line.y - line.fontSize * 0.25,
        width: Math.max(line.width, 1) + 2,
        height: line.fontSize * 1.25,
        color: rgb(1, 1, 1),
      });

      // Fit the translation to the original line width.
      let size = line.fontSize;
      const targetW = Math.max(line.width, 1);
      const measured = font.widthOfTextAtSize(translated, size) || 1;
      if (measured > targetW) size = Math.max(4, (size * targetW) / measured);

      page.drawText(translated, {
        x: line.x,
        y: line.y,
        size,
        font,
        color: rgb(0, 0, 0),
      });
    });

    const bytes = await pdfDoc.save();
    // Copy into a fresh Uint8Array so the Blob gets a clean ArrayBuffer.
    return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  };

  return { kind: "pdf", segments, pageEstimate: Math.max(1, pageCount), build };
}
