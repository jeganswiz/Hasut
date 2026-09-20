import { AdminShell } from "../../components/admin-shell";
import { ThemeEditor } from "../../components/theme-editor";

export default function ThemePage() {
  return (
    <AdminShell
      section="theme"
      title="Theme"
      lede="Draft tokens, contrast warnings, then publish. Clients pick up the published theme from GET /config/theme."
    >
      <ThemeEditor />
    </AdminShell>
  );
}
