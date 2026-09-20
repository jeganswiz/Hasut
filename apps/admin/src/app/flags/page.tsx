import { AdminShell } from "../../components/admin-shell";
import { FlagsPanel } from "../../components/flags-panel";

export default function FlagsPage() {
  return (
    <AdminShell
      section="flags"
      title="Flags"
      lede="Remote feature flags. Secret flags stay off public clients."
    >
      <FlagsPanel />
    </AdminShell>
  );
}
