import { AdminShell } from "../../components/admin-shell";
import { AuditLog } from "../../components/audit-log";

export default function AuditPage() {
  return (
    <AdminShell
      section="audit"
      title="Audit"
      lede="Filter by entity or request id. Phone numbers and exact coordinates are redacted from this viewer."
    >
      <AuditLog />
    </AdminShell>
  );
}
