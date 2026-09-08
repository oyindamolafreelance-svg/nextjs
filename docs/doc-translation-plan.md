# Plan: Layout-Preserving Document Translation ("DocTranslate")

A free, in-house document translator for LinguaBoard members — inspired by
Translayte's **Cipher**, but built entirely on the free stack we already use
(Next.js on Vercel, Supabase, Gemini free tier). Upload a document, get it back
translated **with the original layout intact**, review side-by-side in the
browser, edit, and export.

This lives *alongside* the job board and shares its auth, database, design
system, and the AI fallback chain already in `lib/ai/parse-job.ts`.

---

## Honest quality ceiling (set expectations in the UI)

Free tools cannot match a funded specialist on *every* file. What is realistic:

| Input type | Layout fidelity with free tools | Notes |
|---|---|---|
| **DOCX / PPTX / XLSX** (Office) | **Near-perfect** | Translate text nodes in-place inside the XML; everything else is untouched. This is the easy, high-value win — build it first. |
| **Digital / text PDF** (exported from software) | **Very good** | Text has real coordinates; cover originals + overlay translation. |
| **Scanned PDF / images** | **Good, human-review-required** | OCR gives approximate boxes; flag for review. This is the hard 5% Cipher charges for. |

The product promise is **"layout-preserved, review-ready in minutes — always
human-checked for scans,"** not "perfect on anything." Say so plainly in the UI.

---

## Architecture (queue-and-poll + browser compute — the only way this stays free)

Heavy work must **not** run inside a Vercel function (10–60s timeout, 50MB size
limit, no GPU). Two rules:

1. **Do document processing in the browser** — page render, OCR, and rebuild all
   run client-side (like `ffmpeg.wasm` in the spec). Zero server compute, no
   timeout, no cost. The only thing the server does is the AI **translation**
   call (small JSON in/out).
2. **Queue-and-poll for state** — a Supabase `doc_jobs` row tracks status and
   progress; the browser updates it and (optionally) subscribes via Realtime.

```
Browser                          Vercel (thin)                Supabase
───────                          ─────────────                ────────
upload file ───────────────────────────────────────────────▶ Storage: documents/
create job row ─────────────────────────────────────────────▶ doc_jobs (pending)
extract text + boxes (in browser)
  ├─ Office: unzip XML, walk text nodes
  ├─ digital PDF: pdfjs text + transforms
  └─ scan/image: Tesseract.js OCR + bboxes
batch translate ──▶ POST /api/translate ──▶ AI router (Gemini→…)
                                            returns translated segments
rebuild file (in browser)
  ├─ Office: write translated text back into XML, re-zip
  └─ PDF: pdf-lib — cover original spans, draw translation in same boxes
update job row ─────────────────────────────────────────────▶ doc_jobs (complete, result in Storage)
review + edit + export
```

**Free tools used (all pure-JS / wasm, no server binary):**

- `pdfjs-dist` — render pages + extract text runs *with x/y transforms*.
- `tesseract.js` — OCR for scans/images, returns word-level bounding boxes.
- `pdf-lib` — write the output PDF (cover + overlay text).
- `jszip` + `fast-xml-parser` — open/edit/re-zip DOCX/PPTX/XLSX and IDML.
- `docx` / `pptxgenjs` — optional clean editable-export path.
- Existing **AI router** (Gemini free → Anthropic → offline) — reused, extended
  for translation with per-domain glossary injection.

---

## Cost & abuse ceiling (mandatory — free tiers are strictly rate-limited)

- **Per-user daily page quota** (e.g. 20 pages/day; higher for higher tiers,
  reusing the existing tier system). Enforced in DB, same spirit as give-to-get.
- **Storage auto-expiry** — uploaded + result files deleted after N days by a
  cron (Supabase free Storage is ~1GB). Reuse the existing cron pattern.
- **Translation batching + 429 retry/queue** in the AI router so one big
  document doesn't burn the minute-rate cap or fail the user outright.
- **Size caps** — max pages / max MB per upload, checked before work starts.

---

## Build phases (each phase ships independently and is useful on its own)

### Phase 0 — Shared foundation
- [x] `lib/ai/translate.ts` — segment translation (Gemini → Anthropic),
      batching, split-and-retry on failure/length-mismatch, 429 handling.
- [x] **Domain auto-detect + glossary is a core pre-translation step** (not a
      later add-on): `lib/ai/glossaries.ts` holds per-domain terminology +
      register rules; `detectDomainAndLanguage()` classifies the document on
      upload; the matching glossary is injected into every translation call so
      terminology stays consistent and in-domain (the Cipher-style quality
      win the user asked for). Users can override the detected domain.
- [ ] Migration: `doc_jobs` table (id, user_id, filename, source_lang,
      target_lang, status, progress, page_count, result_path, created_at) + RLS
      (owner-only) + per-user daily page quota function.
- [ ] Supabase Storage bucket `documents` + RLS + a `lib/docs/job.ts` helper
      (create/update/subscribe) and an expiry cron.
- [ ] Route `/tools/translate` gated behind `requireApproved`.

### Phase 1 — Office documents (DOCX / PPTX / XLSX) — the easy win, near-perfect
- [ ] Browser: unzip with `jszip`, parse XML with `fast-xml-parser`, collect all
      text nodes (`w:t`, `a:t`, shared strings) with their paths.
- [ ] Translate collected segments via the router (order preserved, tags kept).
- [ ] Write translated text back into the same nodes, re-zip, download.
- [ ] Handles text expansion automatically (Office reflows) → highest fidelity.

### Phase 2 — Digital (text) PDF — overlay approach ✅ (beta)
- [x] Browser: `pdfjs-dist` extracts text items + transforms per page; grouped
      into visual lines (`lib/docs/pdf.ts`).
- [x] Translate line-by-line; auto-fit font size to the original line width.
- [x] `pdf-lib`: keep the original page (logos/images/vectors stay), cover
      original lines with white boxes, render the translation in place.
- [x] Export translated PDF; uniform pipeline shape shared with Office
      (`lib/docs/index.ts`, `lib/docs/types.ts`).
- [x] **Embedded Unicode fonts** (`lib/docs/fonts.ts` + `@pdf-lib/fontkit`):
      non-Western targets (Chinese, Japanese, Korean, Cyrillic, Greek, Arabic,
      Hebrew, Devanagari, Thai, Latin-extended/African) now render in PDF output
      by fetching a Noto font at runtime and subsetting it into the PDF. Western
      targets keep the lighter standard font. Font CDN is overridable via
      `NEXT_PUBLIC_FONT_BASE`; falls back jsDelivr → unpkg.
- Known limits (surfaced in the UI): best on white-background PDFs; a few
      languages with no Noto mapping yet (e.g. Mongolian, Khmer, Lao, Pashto)
      stay blocked for *digital* PDFs (they work via Office/scan→Word). **Needs
      a real-browser smoke test** — pdf.js rendering and the runtime font fetch
      can only be verified in a browser.
- [ ] Follow-up: optional editable-DOCX export from a PDF; bundle fonts locally
      if the CDN fetch proves unreliable in production.

### Phase 3 — Scanned PDF / images — OCR + editable rebuild, then translate ✅ (v1)
Requested behaviour: for a scan/photo, rebuild it as an **editable file that
mirrors the original**, then translate that clean copy.
- [x] Browser OCR with `tesseract.js` (`lib/docs/ocr.ts`); scanned PDFs are
      rendered to canvas per page via pdf.js, then OCR'd. Source-language →
      OCR language pack mapping; the dispatcher auto-falls-back to OCR when a
      PDF has no text layer, and always OCRs images.
- [x] **Reconstruct → editable DOCX** (via `docx`): paragraphs in reading
      order, **relative font size** derived from OCR line heights (DPI-
      independent), and inferred alignment. Then translate and emit the DOCX.
- [x] OCR + machine-translation output is clearly flagged "review before use";
      progress bar during OCR; first run downloads the engine.
- v1 honest limits (stated in the UI): reconstructs editable text with
      approximate size/structure/alignment — **not** pixel-exact positions, the
      exact original typeface, or embedded logos/figures. OCR can misread.
- [ ] Follow-up: image-region detection to re-embed logos/figures; bold/italic
      detection; closer font-family matching; offer the untranslated rebuild as
      its own "scan → editable Word" output; overlay-translate back onto the
      original PDF when PDF (not Word) output is wanted.

### Phase 4 — Review, edit & polish
- [x] **Side-by-side original vs. translated review step** before the file is
      built: every segment shown with an editable box; edits flow into the
      rebuild (`app/tools/translate/TranslateClient.tsx`). Translation is marked
      complete once it succeeds; the build happens on "Build & download".
- [x] Inputs lock during review so the target language can't drift out of sync.
- [x] Low-resource-pair warning banner → mandatory review (from Phase 1).
- [ ] Per-domain **custom glossary manager** (admin-editable terms stored in the
      DB, injected alongside the built-in glossary) — the next differentiator.
- [ ] A translation-history page from `doc_jobs` (member sees past jobs).
- [ ] Reconstruction upgrades from Phase 3 (logos/figures, bold/italic, fonts).

### Phase 5 (optional, later) — heavier lift
- [ ] Move OCR/large jobs to a free GitHub-Actions worker (we already run one
      for sourcing) for users on weak devices.
- [ ] Groq / OpenRouter as extra fallback tiers in the router.
- [ ] Optional paid upgrade path (higher quotas / dedicated infra) — one config
      change in the router, no rewrite.

---

## Why this doesn't compete with Cipher (and shouldn't try to)

Cipher sells layout-preserving translation to **agencies** as a standalone paid
product with real infra and SOC-2 compliance. Our version is a **free member
perk** that makes translators more productive and keeps them on the board. We
win on *community + jobs*, not on being the world's best PDF engine — so we lead
with the cheap, near-perfect Office path and treat perfect-scan fidelity as an
explicit, review-required limitation rather than a promise.
