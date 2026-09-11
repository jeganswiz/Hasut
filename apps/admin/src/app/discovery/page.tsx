import { AdminShell } from "../../components/admin-shell";
import { DiscoverySettings } from "../../components/discovery-settings";

export default function DiscoveryPage() {
  return (
    <AdminShell
      section="discovery"
      title="Discovery"
      lede="Admin-controlled defaults, basemap, and ranking weights. Member apps read these from configuration."
    >
      <DiscoverySettings />
    </AdminShell>
  );
}
