import { AdminShell } from "../components/admin-shell";
import { HealthPanel } from "../components/health-panel";
import { loadApiHealth } from "../lib/load-health";

export default async function HomePage() {
  const initialHealth = await loadApiHealth();

  return (
    <AdminShell
      section="overview"
      title="HASUT Admin"
      lede="Operations console. Manage the live category tree and discovery defaults used by member apps."
    >
      <HealthPanel initialHealth={initialHealth} />
    </AdminShell>
  );
}
