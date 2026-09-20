import { AdminShell } from "../components/admin-shell";
import { HealthPanel } from "../components/health-panel";
import { OpsSummaryPanel } from "../components/ops-summary-panel";
import { loadApiHealth } from "../lib/load-health";

export default async function HomePage() {
  const initialHealth = await loadApiHealth();

  return (
    <AdminShell
      section="overview"
      title="HASUT Admin"
      lede="Operations console. Queue counts are live. Sign in to act on verification, reports, and tickets."
    >
      <OpsSummaryPanel />
      <HealthPanel initialHealth={initialHealth} />
    </AdminShell>
  );
}
