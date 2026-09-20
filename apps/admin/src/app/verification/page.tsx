import { AdminShell } from "../../components/admin-shell";
import { VerificationQueue } from "../../components/verification-queue";

export default function VerificationPage() {
  return (
    <AdminShell
      section="verification"
      title="Identity verification"
      lede="Review identity documents only. Approving identity never implies a skill is verified."
    >
      <VerificationQueue />
    </AdminShell>
  );
}
