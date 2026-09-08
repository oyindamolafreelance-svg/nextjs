import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TranslateClient } from "./TranslateClient";

export const dynamic = "force-dynamic";

export default async function TranslatePage() {
  await requireApproved("/tools/translate");
  const supabase = await createClient();
  const [{ data: used }, { data: allowance }] = await Promise.all([
    supabase.rpc("my_docs_today"),
    supabase.rpc("my_doc_allowance"),
  ]);
  const usedN = typeof used === "number" ? used : 0;
  const allowanceN = typeof allowance === "number" ? allowance : 15;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Document translator</h1>
        <p className="mt-1 text-sm muted">
          Upload a Word, PowerPoint, Excel or PDF file — or a scan/photo. We
          detect the domain, apply the matching terminology, and translate in
          your browser. Office files and digital PDFs keep their layout; scans
          and images are read with OCR and rebuilt as an editable Word file.
        </p>
      </div>
      <TranslateClient
        used={usedN}
        allowance={allowanceN}
        unlimited={allowanceN >= 1_000_000}
      />
    </div>
  );
}
