"use client";

import { HasutApiError } from "@hasut/api-client";
import type {
  ConnectionView,
  LiveSessionView,
  PublicMemberProfile,
  ReportReasonView,
  StoryView,
} from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProfileStories } from "../../../../components/profile-stories";
import { createWebApiClient } from "../../../../lib/api";

export default function MemberProfilePage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<SurfaceState>("loading");
  const [profile, setProfile] = useState<PublicMemberProfile | null>(null);
  const [connection, setConnection] = useState<ConnectionView | null>(null);
  const [reasons, setReasons] = useState<ReportReasonView[]>([]);
  const [reasonCode, setReasonCode] = useState("");
  const [stories, setStories] = useState<StoryView[]>([]);
  const [live, setLive] = useState<LiveSessionView | null>(null);
  const [reminded, setReminded] = useState(false);
  const [message, setMessage] = useState("Loading profile…");

  const load = useCallback(async () => {
    try {
      const client = createWebApiClient();
      const [data, lookup, reports, posted, presence, reminder] = await Promise.all([
        client.getMember(params.id),
        client.getConnectionWith(params.id).catch(() => ({ connection: null })),
        client.getReportsPolicy(),
        client.listMemberStories(params.id).catch(() => [] as StoryView[]),
        client.getMemberLive(params.id).catch(() => null),
        client.getLiveReminder(params.id).catch(() => ({ creatorId: params.id, reminded: false })),
      ]);
      setProfile(data);
      setStories(posted);
      setLive(presence);
      setReminded(reminder.reminded);
      setConnection(lookup.connection);
      setReasons(reports.reasonCodes);
      setReasonCode(reports.reasonCodes[0]?.code ?? "");
      setState("success");
      setMessage(data.bio || "Member profile");
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load this profile.");
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function connect(): Promise<void> {
    try {
      setConnection(await createWebApiClient().requestConnection(params.id));
    } catch (error) {
      setMessage(error instanceof HasutApiError ? error.message : "Unable to send request.");
    }
  }

  return (
    <main>
      <h1>{profile?.displayName ?? "Member"}</h1>
      <Surface state={state} title="Profile">
        {live?.status === "LIVE" ? (
          <p>
            <Link className="lv-live-badge" href={`/live/${live.id}`}>
              LIVE now
            </Link>
          </p>
        ) : null}
        <p>{message}</p>
        {profile?.currentMode ? <p>{profile.currentMode.label}</p> : null}
        {profile?.approximateLocation ? <p>{profile.approximateLocation.label}</p> : null}
        {stories.length > 0 ? <ProfileStories stories={stories} memberId={params.id} /> : null}
        <div className="actions">
          <Link href={`/stories/${params.id}`}>Watch presence</Link>
          {live?.status === "LIVE" ? <Link href={`/live/${live.id}`}>Watch live</Link> : null}
          {live?.status !== "LIVE" ? (
            <Button
              variant="secondary"
              onClick={() => {
                void createWebApiClient()
                  .setLiveReminder(params.id, !reminded)
                  .then((next) => setReminded(next.reminded));
              }}
            >
              {reminded ? "Reminders on" : "Remind me"}
            </Button>
          ) : null}
          {connection === null ? <Button onClick={() => void connect()}>Connect</Button> : null}
          {connection?.status === "PENDING" && connection.direction === "OUTGOING" ? (
            <Button
              variant="secondary"
              onClick={() => void createWebApiClient().cancelConnection(connection.id).then(load)}
            >
              Cancel request
            </Button>
          ) : null}
          {connection?.status === "PENDING" && connection.direction === "INCOMING" ? (
            <>
              <Button
                onClick={() => void createWebApiClient().acceptConnection(connection.id).then(load)}
              >
                Accept
              </Button>
              <Button
                variant="secondary"
                onClick={() => void createWebApiClient().rejectConnection(connection.id).then(load)}
              >
                Reject
              </Button>
            </>
          ) : null}
          {connection?.status === "ACCEPTED" && connection.conversationId !== null ? (
            <Link href={`/conversations/${connection.conversationId}`}>Open chat</Link>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => {
              void createWebApiClient()
                .blockMember(params.id)
                .then(() => {
                  setMessage("This member is blocked. They cannot connect or chat with you.");
                })
                .catch((error: unknown) => {
                  setMessage(error instanceof HasutApiError ? error.message : "Unable to block.");
                });
            }}
          >
            Block
          </Button>
        </div>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void createWebApiClient()
              .createReport({
                targetType: "MEMBER",
                targetId: params.id,
                reasonCode,
              })
              .then(() => setMessage("Report submitted."))
              .catch((error: unknown) => {
                setMessage(error instanceof HasutApiError ? error.message : "Unable to report.");
              });
          }}
        >
          <label>
            Report reason
            <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
              {reasons.map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="secondary">
            Report
          </Button>
        </form>
      </Surface>
    </main>
  );
}
