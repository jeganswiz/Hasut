import { AdminShell } from "../../components/admin-shell";
import { ReportsQueue } from "../../components/reports-queue";

export default function ReportsPage() {
  return (
    <AdminShell
      section="reports"
      title="Reports"
      lede="Hide reported content or dismiss the report. Member phone numbers stay off this screen."
    >
      <ReportsQueue />
    </AdminShell>
  );
}
