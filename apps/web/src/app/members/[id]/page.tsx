"use client";

import { HasutApiError } from "@hasut/api-client";
import type { ConnectionView, PublicMemberProfile, ReportReasonView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "../../../components/app-nav";
import { createWebApiClient } from "../../../lib/api";
import "../../social.css";

export default function MemberProfilePage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<SurfaceState>("loading");
  const [profile, setProfile] = useState<PublicMemberProfile | null>(null);
  const [connection, setConnection] = useState<ConnectionView | null>(null);
  const [reasons, setReasons] = useState<ReportReasonView[]>([]);
  const [reasonCode, setReasonCode] = useState("");
  const [message, setMessage] = useState("Loading profile…");

  const load = useCallback(async () => {
    try {
      const client = createWebApiClient();
      const [data, lookup, reports] = await Promise.all([
        client.getMember(params.id),
        client.getConnectionWith(params.id).catch(() => ({ connection: null })),
        client.getReportsPolicy(),
      ]);
      setProfile(data);
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
      <AppNav />
      <h1>{profile?.displayName ?? "Member"}</h1>
      <Surface state={state} title="Profile">
        <p>{message}</p>
        {profile?.currentMode ? <p>{profile.currentMode.label}</p> : null}
        {profile?.approximateLocation ? <p>{profile.approximateLocation.label}</p> : null}
        <div className="actions">
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
            <a href={`/conversations/${connection.conversationId}`}>Open chat</a>
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
