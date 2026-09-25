"use client";

import { useState } from "react";
import s from "./admin.module.css";

const MAX_EDGE = 2000;
const PDF_LIMIT = 4 * 1024 * 1024;

// Downscales photos (JPEG, 2000px) before upload so phone pictures stay well under
// the server limit. PDFs are sent as they are, up to 4 MB.
async function shrink(file: File) {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
}

export function ReceiptInput() {
  const [note, setNote] = useState<string | null>(null);
  return <label className={s.field}>Receipt (optional)
    <input className={s.input} type="file" name="receipt" accept="image/*,application/pdf" onChange={async (e) => {
      const input = e.currentTarget; const file = input.files?.[0];
      setNote(null);
      if (!file) return;
      try {
        const ready = await shrink(file);
        if (ready.size > PDF_LIMIT) { input.value = ""; setNote("That file is over 4 MB. Try a photo or a smaller PDF."); return; }
        if (ready !== file) { const dt = new DataTransfer(); dt.items.add(ready); input.files = dt.files; }
        setNote(`${Math.round(ready.size / 1024)} KB ready`);
      } catch { setNote("Couldn’t read that image; it will be uploaded as is."); }
    }} />
    {note && <span className={s.hint}>{note}</span>}
  </label>;
}
