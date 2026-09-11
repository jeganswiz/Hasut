import { HealthPanel } from "../components/health-panel";
import { loadApiHealth } from "../lib/load-health";

export default async function HomePage() {
  const initialHealth = await loadApiHealth();

  return (
    <main>
      <h1>HASUT Admin</h1>
      <p className="lede">
        Operations console. Manage the live category tree used by member onboarding.
      </p>
      <p className="actions">
        <a href="/login">Sign in</a>
        <a href="/categories">Categories</a>
        <a href="/discovery">Discovery</a>
      </p>
      <HealthPanel initialHealth={initialHealth} />
    </main>
  );
}
