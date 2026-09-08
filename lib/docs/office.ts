// Browser-side Office document processing for the translator.
//
// Runs entirely in the user's browser (no server compute, no upload of the
// file itself): unzip the .docx/.pptx/.xlsx, pull out its text at the
// PARAGRAPH level (so a sentence split across styled runs is translated as one
// natural unit, not word-by-word), then write the translations back into the
// same XML and re-zip. Because only text nodes change, the original layout —
// tables, images, styles, headers — is preserved automatically.
//
// Trade-off (documented for honesty): when a paragraph mixes formatting
// (e.g. one bold word mid-sentence), the whole translated paragraph inherits
// the first run's formatting. Layout/position is kept; sub-paragraph
// character formatting may be flattened. This is the right call for
// translation quality and is what most layout-preserving tools do.

import JSZip from "jszip";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

export type OfficeKind = "docx" | "pptx" | "xlsx";

export interface OfficeDoc {
  kind: OfficeKind;
  segments: string[]; // paragraph-level source text, in document order
  pageEstimate: number;
  build: (translations: string[]) => Promise<Blob>;
}

const MIME: Record<OfficeKind, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// Per-format tag names: (paragraph container, text element).
const TAGS: Record<OfficeKind, { para: string; text: string }> = {
  docx: { para: "w:p", text: "w:t" },
  pptx: { para: "a:p", text: "a:t" },
  xlsx: { para: "si", text: "t" },
};

type PNode = Record<string, unknown>;
interface TextHolder {
  holder: PNode; // the { "#text": "..." } object we mutate
  el: PNode; // the enclosing <w:t>/<a:t>/<t> node (for xml:space)
}

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
});
const builder = new XMLBuilder({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  suppressEmptyNode: false,
});

function tagOf(node: PNode): string | null {
  for (const k of Object.keys(node)) {
    if (k !== ":@") return k;
  }
  return null;
}

function collectTextHolders(nodes: PNode[], textTag: string, out: TextHolder[]) {
  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === null || tag === "#text") continue;
    if (tag === textTag) {
      const children = node[tag];
      const arr = Array.isArray(children) ? (children as PNode[]) : [];
      let holder = arr.find((c) => "#text" in c);
      if (!holder) {
        holder = { "#text": "" };
        arr.push(holder);
        node[tag] = arr;
      }
      out.push({ holder, el: node });
    } else if (Array.isArray(node[tag])) {
      collectTextHolders(node[tag] as PNode[], textTag, out);
    }
  }
}

function collectParagraphs(nodes: PNode[], paraTag: string, textTag: string, out: TextHolder[][]) {
  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === null || tag === "#text") continue;
    if (tag === paraTag) {
      const holders: TextHolder[] = [];
      collectTextHolders(node[tag] as PNode[], textTag, holders);
      if (holders.length > 0) out.push(holders);
    } else if (Array.isArray(node[tag])) {
      collectParagraphs(node[tag] as PNode[], paraTag, textTag, out);
    }
  }
}

function setSpacePreserve(el: PNode) {
  const attrs = (el[":@"] as Record<string, string>) ?? {};
  attrs["@_xml:space"] = "preserve";
  el[":@"] = attrs;
}

function extFromName(name: string): OfficeKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".pptx")) return "pptx";
  if (lower.endsWith(".xlsx")) return "xlsx";
  return null;
}

export function isSupportedOffice(name: string): boolean {
  return extFromName(name) !== null;
}

// Which XML parts inside the archive carry translatable text, per format.
function targetPaths(kind: OfficeKind, zip: JSZip): string[] {
  const names = Object.keys(zip.files);
  if (kind === "docx") {
    return names.filter(
      (n) =>
        n === "word/document.xml" ||
        /^word\/(header|footer)\d*\.xml$/.test(n) ||
        n === "word/footnotes.xml" ||
        n === "word/endnotes.xml"
    );
  }
  if (kind === "pptx") {
    return names.filter(
      (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n) || /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)
    );
  }
  // xlsx: all user-visible strings live in the shared string table.
  return names.filter((n) => n === "xl/sharedStrings.xml");
}

export async function loadOffice(file: File): Promise<OfficeDoc> {
  const kind = extFromName(file.name);
  if (!kind) {
    throw new Error("Unsupported file. Use a .docx, .pptx or .xlsx file.");
  }
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const { para, text } = TAGS[kind];
  const paths = targetPaths(kind, zip);

  interface FilePart {
    path: string;
    tree: PNode[];
    groups: TextHolder[][];
    start: number; // index into the flat segments array
  }

  const parts: FilePart[] = [];
  const segments: string[] = [];

  for (const path of paths) {
    const xml = await zip.file(path)!.async("string");
    const tree = parser.parse(xml) as PNode[];
    const groups: TextHolder[][] = [];
    collectParagraphs(tree, para, text, groups);
    const start = segments.length;
    for (const g of groups) {
      segments.push(g.map((h) => String(h.holder["#text"] ?? "")).join(""));
    }
    parts.push({ path, tree, groups, start });
  }

  const totalChars = segments.reduce((n, s) => n + s.length, 0);
  const slideCount =
    kind === "pptx" ? paths.filter((p) => /slides\/slide\d+\.xml$/.test(p)).length : 0;
  const pageEstimate =
    kind === "pptx"
      ? Math.max(1, slideCount)
      : Math.max(1, Math.ceil(totalChars / 1800));

  const build = async (translations: string[]): Promise<Blob> => {
    if (translations.length !== segments.length) {
      throw new Error("Translation count did not match the document. Please retry.");
    }
    for (const part of parts) {
      part.groups.forEach((holders, i) => {
        const translated = translations[part.start + i] ?? segments[part.start + i];
        // Put the whole translated paragraph in the first run; blank the rest.
        holders[0].holder["#text"] = translated;
        setSpacePreserve(holders[0].el);
        for (let k = 1; k < holders.length; k++) {
          holders[k].holder["#text"] = "";
        }
      });
      const outXml = builder.build(part.tree);
      zip.file(part.path, outXml);
    }
    return zip.generateAsync({
      type: "blob",
      mimeType: MIME[kind],
      compression: "DEFLATE",
    });
  };

  return { kind, segments, pageEstimate, build };
}
