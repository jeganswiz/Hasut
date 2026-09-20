import { AdminShell } from "../../components/admin-shell";
import { TemplatesPanel } from "../../components/templates-panel";

export default function TemplatesPage() {
  return (
    <AdminShell
      section="templates"
      title="Templates"
      lede="Notification copy is stored as templates. Identity copy must never say skill verification."
    >
      <TemplatesPanel />
    </AdminShell>
  );
}
