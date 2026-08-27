"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type UploadState = "idle" | "uploading" | "processing";

type ReceiptUploadFormProps = {
  householdId: string;
};

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  return "jpg";
}

export function ReceiptUploadForm({ householdId }: ReceiptUploadFormProps) {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError("Please select a receipt photo.");
      return;
    }

    if (!ALLOWED_MIME_TYPES.has(selectedFile.type)) {
      setError("Invalid file type. Use JPEG, PNG, or WebP.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setError("File too large. Maximum size is 10 MB.");
      return;
    }

    const extension = extensionForMimeType(selectedFile.type);
    const storagePath = `${householdId}/${crypto.randomUUID()}.${extension}`;

    setUploadState("uploading");

    const { error: uploadError } = await supabaseBrowser()
      .storage.from("receipts")
      .upload(storagePath, selectedFile, { upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setUploadState("idle");
      return;
    }

    setUploadState("processing");

    const response = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath, storeName: storeName.trim() }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Processing failed");
      setUploadState("idle");
      return;
    }

    const body = (await response.json()) as { pending_receipt_id: string };
    router.push(`/receipts/${body.pending_receipt_id}`);
  }

  const isBusy = uploadState !== "idle";
  const submitLabel =
    uploadState === "uploading"
      ? "Uploading..."
      : uploadState === "processing"
        ? "Processing..."
        : "Upload receipt";

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      {error && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="store-name" className="mb-1 block text-sm font-medium">
          Store name
        </label>
        <input
          id="store-name"
          type="text"
          value={storeName}
          onChange={(event) => setStoreName(event.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
          placeholder="e.g. Costco"
        />
      </div>

      <div>
        <label htmlFor="receipt-photo" className="mb-1 block text-sm font-medium">
          Receipt photo
        </label>
        <input
          id="receipt-photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="w-full"
        />
      </div>

      <button
        type="submit"
        disabled={isBusy || !selectedFile}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
