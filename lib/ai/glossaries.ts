// Domain detection + per-domain glossary/style rules.
//
// This is the quality differentiator: before translating a document we detect
// its field, then inject the matching terminology + register instructions into
// every translation call so the output is consistent and idiomatic for that
// domain (a "defendant" stays "defendant", not "accused person"; a "commit"
// in software stays "commit", not "promise"). Seed terms are intentionally
// small and illustrative — extend per language over time, or let admins add
// custom terms later (Phase 4).

export type DomainId =
  | "general"
  | "legal"
  | "medical"
  | "technical"
  | "software"
  | "financial"
  | "marketing"
  | "patent"
  | "gaming"
  | "academic";

export interface DomainDef {
  id: DomainId;
  label: string;
  // One-line register/style instruction fed to the model.
  style: string;
  // Source-term hints that tell the model which vocabulary to keep precise.
  // These are English anchors; the model renders the target-language
  // equivalent consistently across the whole document.
  terms: string[];
}

export const DOMAINS: DomainDef[] = [
  {
    id: "general",
    label: "General",
    style:
      "Translate naturally and clearly for a general reader, matching the tone of the source.",
    terms: [],
  },
  {
    id: "legal",
    label: "Legal",
    style:
      "Use formal legal register and the target legal system's standard terminology. Preserve defined terms, party labels, clause numbering, and the precise meaning of obligations (shall/may). Do not simplify legal terms of art.",
    terms: [
      "plaintiff", "defendant", "hereinafter", "whereas", "indemnify",
      "jurisdiction", "liability", "party", "witness", "affidavit",
      "power of attorney", "notary", "shall", "hereby", "governing law",
    ],
  },
  {
    id: "medical",
    label: "Medical / Healthcare",
    style:
      "Use precise clinical terminology and the register expected in medical records or patient documents. Keep drug names, dosages, units, and anatomical terms exact; never guess a clinical term.",
    terms: [
      "diagnosis", "prognosis", "dosage", "contraindication", "adverse event",
      "prescription", "symptom", "treatment", "informed consent", "referral",
      "chronic", "acute", "mg", "ml",
    ],
  },
  {
    id: "technical",
    label: "Technical / Engineering",
    style:
      "Use precise engineering terminology and an instructional register. Keep units, measurements, part names, and safety warnings exact and consistent.",
    terms: [
      "torque", "tolerance", "calibration", "assembly", "specification",
      "voltage", "load", "maintenance", "warning", "caution",
    ],
  },
  {
    id: "software",
    label: "Software / IT / UI strings",
    style:
      "Use standard software/UI terminology for the target locale. Keep placeholders (e.g. {name}, %s, %1$s), code, variable names, HTML/XML tags, and keyboard keys unchanged. Use imperative UI style for buttons and menus.",
    terms: [
      "commit", "repository", "deploy", "cache", "token", "endpoint",
      "login", "sign out", "settings", "dashboard", "upload", "download",
      "username", "password",
    ],
  },
  {
    id: "financial",
    label: "Financial / Business",
    style:
      "Use standard financial and accounting terminology. Keep currency codes, amounts, percentages, and figures exact. Match the register of financial statements and business correspondence.",
    terms: [
      "revenue", "liability", "equity", "invoice", "balance sheet",
      "cash flow", "dividend", "interest rate", "assets", "shareholder",
    ],
  },
  {
    id: "marketing",
    label: "Marketing / Creative",
    style:
      "Transcreate rather than translate literally: preserve intent, persuasion, and brand voice, adapting idioms and wordplay to sound native and compelling in the target language.",
    terms: [],
  },
  {
    id: "patent",
    label: "Patent / IP",
    style:
      "Use the rigid, formulaic register of patent claims. Preserve claim structure, numbering, reference signs/numerals, and 'means for' constructions. Consistency of every technical term across claims is critical.",
    terms: [
      "claim", "embodiment", "prior art", "wherein", "comprising",
      "means for", "apparatus", "said", "reference numeral",
    ],
  },
  {
    id: "gaming",
    label: "Gaming / Entertainment",
    style:
      "Use natural, engaging game localization style. Keep character/item/skill names consistent, respect UI length limits where visible, and preserve placeholders and variables unchanged.",
    terms: ["quest", "level", "inventory", "cooldown", "achievement", "guild"],
  },
  {
    id: "academic",
    label: "Academic / Scientific",
    style:
      "Use formal academic register. Keep citations, references, figure/table labels, and technical terminology precise and consistent.",
    terms: ["hypothesis", "methodology", "abstract", "citation", "peer review", "figure"],
  },
];

export function getDomain(id: string | undefined | null): DomainDef {
  return DOMAINS.find((d) => d.id === id) ?? DOMAINS[0];
}

// A compact instruction block describing the domain + its key terminology,
// injected into the translation system prompt.
export function domainInstruction(id: string | undefined | null): string {
  const d = getDomain(id);
  let out = `Document domain: ${d.label}. ${d.style}`;
  if (d.terms.length > 0) {
    out +=
      ` Treat these as domain terms of art — translate each one with the single most standard target-language equivalent and use it consistently everywhere it appears: ${d.terms.join(", ")}.`;
  }
  return out;
}
