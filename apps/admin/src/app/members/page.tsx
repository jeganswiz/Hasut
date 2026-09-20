import { AdminShell } from "../../components/admin-shell";
import { MembersTable } from "../../components/members-table";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  return (
    <AdminShell
      section="members"
      title="Members"
      lede="Search by display name. Phone numbers and exact coordinates stay off this console."
    >
      <MembersTable initialQuery={params.q ?? ""} />
    </AdminShell>
  );
}
