"use client";

import { HasutApiError } from "@hasut/api-client";
import type { AdminMemberDetail, AdminMemberView, MemberRole } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { useAdminSession } from "../lib/use-admin-session";

const ROLE_OPTIONS: MemberRole[] = ["MEMBER", "ADMIN", "SUPPORT_AGENT", "MODERATOR"];

export function MembersTable({ initialQuery = "" }: { initialQuery?: string }) {
  const { ready, denied } = useAdminSession(["ADMIN"]);
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Search members by display name. Phone is never shown.");
  const [query, setQuery] = useState(initialQuery);
  const [rows, setRows] = useState<AdminMemberView[]>([]);
  const [detail, setDetail] = useState<AdminMemberDetail | null>(null);

  const load = useCallback(async (q: string) => {
    setState("loading");
    try {
      const data = await createAdminApiClient().searchMembers(q);
      setRows(data);
      setState(data.length === 0 ? "empty" : "success");
      setMessage(
        data.length === 0
          ? "No members match this search."
          : "Suspend, restore, or revoke sessions. Phone numbers stay off this table.",
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to search members.");
    }
  }, []);

  useEffect(() => {
    if (ready) {
      void load(query);
    }
  }, [load, query, ready]);

  if (denied !== null) {
    return (
      <Surface state="error" title="Members">
        <p>{denied}</p>
      </Surface>
    );
  }

  async function openDetail(id: string): Promise<void> {
    try {
      setDetail(await createAdminApiClient().getAdminMember(id));
    } catch (error) {
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load member.");
    }
  }

  return (
    <Surface state={state} title="Members">
      <p>{message}</p>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setQuery(String(data.get("q") ?? ""));
        }}
      >
        <label>
          Search
          <input name="q" defaultValue={query} aria-label="Search members" />
        </label>
        <Button type="submit">Search</Button>
      </form>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Roles</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.displayName}</td>
              <td>{row.status}</td>
              <td>{row.roles.join(", ")}</td>
              <td>{row.createdAt.slice(0, 10)}</td>
              <td>
                <Button variant="secondary" onClick={() => void openDetail(row.id)}>
                  Open
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {detail !== null ? (
        <div className="stack">
          <h3>{detail.displayName}</h3>
          <p>
            {detail.status} · {detail.sessionCount} sessions · {detail.roles.join(", ")}
          </p>
          <div className="actions">
            {detail.status === "ACTIVE" ? (
              <Button
                onClick={() =>
                  void createAdminApiClient()
                    .suspendMember(detail.id)
                    .then(setDetail)
                    .then(() => load(query))
                }
              >
                Suspend
              </Button>
            ) : (
              <Button
                onClick={() =>
                  void createAdminApiClient()
                    .restoreMember(detail.id)
                    .then(setDetail)
                    .then(() => load(query))
                }
              >
                Restore
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() =>
                void createAdminApiClient().revokeMemberSessions(detail.id).then(setDetail)
              }
            >
              Revoke sessions
            </Button>
          </div>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const next = ROLE_OPTIONS.filter((role) => data.get(role) === "on");
              void createAdminApiClient()
                .setMemberRoles(detail.id, next)
                .then(setDetail)
                .then(() => load(query));
            }}
          >
            {ROLE_OPTIONS.map((role) => (
              <label key={role}>
                <input type="checkbox" name={role} defaultChecked={detail.roles.includes(role)} />{" "}
                {role}
              </label>
            ))}
            <Button type="submit" variant="secondary">
              Save roles
            </Button>
          </form>
        </div>
      ) : null}
    </Surface>
  );
}
