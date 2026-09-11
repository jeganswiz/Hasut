import { DiscoverySettings } from "../../components/discovery-settings";

export default function DiscoveryPage() {
  return (
    <main>
      <h1>Discovery</h1>
      <p className="lede">
        Admin-controlled defaults and ranking weights. Member apps read these from configuration.
      </p>
      <DiscoverySettings />
    </main>
  );
}
