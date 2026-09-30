import { AdminShell } from "../../components/admin-shell";
import { StorageSettings } from "../../components/storage-settings";

export default function StoragePage() {
  return (
    <AdminShell
      section="storage"
      title="Storage"
      lede="Choose where photos, video, and audio are stored. Switching can move existing files, and the transfer log stays on this page."
    >
      <StorageSettings />
    </AdminShell>
  );
}
