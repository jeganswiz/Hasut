import { AdminShell } from "../../components/admin-shell";
import { StoriesQueue } from "../../components/stories-queue";

export default function StoriesPage() {
  return (
    <AdminShell
      section="stories"
      title="Stories"
      lede="Moderate map presence stories and live HLS. This is not a social feed and not skill verification."
    >
      <StoriesQueue />
    </AdminShell>
  );
}
