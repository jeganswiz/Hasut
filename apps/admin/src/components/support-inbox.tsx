"use client";

import { HasutApiError } from "@hasut/api-client";
import type { StaffMemberView, SupportTicketDetail, SupportTicketView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { createAdminApiClient } from "../lib/api";
import { useAdminSession } from "../lib/use-admin-session";

export function SupportInbox() {
  const { ready, denied } = useAdminSession(["ADMIN", "SUPPORT_AGENT"]);
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading support tickets…");
  const [items, setItems] = useState<SupportTicketView[]>([]);
  const [staff, setStaff] = useState<StaffMemberView[]>([]);
  const [open, setOpen] = useState<SupportTicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [queue, operators] = await Promise.all([
        createAdminApiClient().listAdminSupportTickets(),
        createAdminApiClient().listStaff(),
      ]);
      setItems(queue);
      setStaff(operators);
      setState(queue.length === 0 ? "empty" : "success");
      setMessage(queue.length === 0 ? "No support tickets." : "Assign, reply, note, or resolve.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load tickets.");
    }
  }, []);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [load, ready]);

  if (denied !== null) {
    return (
      <Surface state="error" title="Support">
        <p>{denied}</p>
      </Surface>
    );
  }

  async function openTicket(id: string): Promise<void> {
    setState("loading");
    try {
      setOpen(await createAdminApiClient().getSupportTicket(id));
      setState("success");
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to open ticket.");
    }
  }

  return (
    <Surface state={state} title="Support inbox">
      <p>{message}</p>
      <div className="stack">
        {items.map((item) => (
          <article key={item.id}>
            <button type="button" onClick={() => void openTicket(item.id)}>
              {item.subject}
            </button>
            <p>
              {item.status} · {item.category.name} · {item.member.displayName}
            </p>
          </article>
        ))}
      </div>
      {open !== null ? (
        <div className="stack">
          <h3>{open.subject}</h3>
          {open.messages.map((item) => (
            <p key={item.id}>
              <strong>{item.author.displayName}:</strong> {item.body}
            </p>
          ))}
          {open.notes.map((item) => (
            <p key={item.id}>
              Internal · {item.author.displayName}: {item.body}
            </p>
          ))}
          <label>
            Reply
            <textarea value={reply} onChange={(event) => setReply(event.target.value)} />
          </label>
          <Button
            onClick={() => {
              void createAdminApiClient()
                .replySupportTicket(open.id, reply)
                .then(() => {
                  setReply("");
                  return openTicket(open.id);
                });
            }}
          >
            Send reply
          </Button>
          <label>
            Internal note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <Button
            variant="secondary"
            onClick={() => {
              void createAdminApiClient()
                .addSupportNote(open.id, note)
                .then(() => {
                  setNote("");
                  return openTicket(open.id);
                });
            }}
          >
            Add note
          </Button>
          <label>
            Assign
            <select
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) {
                  void createAdminApiClient()
                    .assignSupportTicket(open.id, event.target.value)
                    .then(() => openTicket(open.id));
                }
              }}
            >
              <option value="">Choose staff</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.displayName}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="secondary"
            onClick={() => {
              void createAdminApiClient()
                .patchSupportTicket(open.id, { status: "RESOLVED" })
                .then(load);
            }}
          >
            Resolve
          </Button>
        </div>
      ) : null}
    </Surface>
  );
}
