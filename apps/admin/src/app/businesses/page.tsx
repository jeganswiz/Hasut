import { AdminShell } from "../../components/admin-shell";
import { BusinessesTable } from "../../components/businesses-table";

export default function BusinessesPage() {
  return (
    <AdminShell
      section="businesses"
      title="Businesses"
      lede="Listed businesses. Owner phone stays off this table."
    >
      <BusinessesTable />
    </AdminShell>
  );
}
