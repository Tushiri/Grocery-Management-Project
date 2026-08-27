import { ReceiptUploadForm } from "@/components/receipts/ReceiptUploadForm";
import { getHouseholdIdForUser } from "@/lib/household/get-household-id";

export default async function ReceiptsPage() {
  const householdId = await getHouseholdIdForUser();

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Upload Receipt</h1>
      <ReceiptUploadForm householdId={householdId} />
    </main>
  );
}
