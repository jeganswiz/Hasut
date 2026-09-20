import { AdminShell } from "../../components/admin-shell";
import { SupportInbox } from "../../components/support-inbox";

export default function SupportPage() {
  return (
    <AdminShell
      section="support"
      title="Support"
      lede="Tickets, assignment, internal notes, and resolution. Categories come from configuration."
    >
      <SupportInbox />
    </AdminShell>
  );
}
