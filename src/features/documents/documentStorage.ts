import { supabase } from "@/lib/supabase";
import type { Document } from "@/types/database";

export const documentsBucketName = "event-documents";

export function safeDocumentFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

export function formatDocumentFileSize(size: number | null) {
  if (!size) return "Sin tamaño";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export async function openStoredDocument(document: Pick<Document, "file_path" | "mime_type" | "file_name">) {
  const { data, error } = await supabase.storage.from(documentsBucketName).createSignedUrl(document.file_path, 60 * 5);

  if (error) {
    throw new Error(error.message);
  }

  if (document.mime_type === "text/html" || document.file_name.endsWith(".html")) {
    const response = await fetch(data.signedUrl);
    const html = await response.text();
    const popup = window.open("", "_blank", "width=900,height=700");

    if (!popup) {
      throw new Error("El navegador bloqueó la ventana emergente del documento.");
    }

    popup.document.write(html);
    popup.document.close();
    popup.focus();
    return;
  }

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}
