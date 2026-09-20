import { AdminShell } from "../../components/admin-shell";
import { ProfessionalsTable } from "../../components/professionals-table";

export default function ProfessionalsPage() {
  return (
    <AdminShell
      section="professionals"
      title="Professionals"
      lede="Catalog of professional profiles. Identity verification is not skill verification."
    >
      <ProfessionalsTable />
    </AdminShell>
  );
}
