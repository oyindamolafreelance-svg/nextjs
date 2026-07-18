import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "File upload isn't configured. Set BLOB_READ_WRITE_TOKEN (Vercel Blob) or paste a hosted media URL instead.",
      },
      { status: 501 }
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }

  const blob = await put(file.name, file, { access: "public", addRandomSuffix: true });

  return NextResponse.json({ url: blob.url });
}
