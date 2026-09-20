import { AdminShell } from "../../../components/admin-shell";
import { AudioLibraryPanel } from "../../../components/audio-library-panel";

export default function StoryAudioPage() {
  return (
    <AdminShell
      section="story-audio"
      title="Story audio"
      lede="Curate the HASUT cloud soundtracks members can attach to a story. Only licensed audio belongs here."
    >
      <AudioLibraryPanel />
    </AdminShell>
  );
}
