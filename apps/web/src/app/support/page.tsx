"use client";

import { HasutApiError } from "@hasut/api-client";
import type { SupportCategoryView, SupportTicketDetail, SupportTicketView } from "@hasut/types";
import { Button, Surface, type SurfaceState } from "@hasut/ui";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "../../components/app-nav";
import { createWebApiClient } from "../../lib/api";
import "../social.css";

export default function SupportPage() {
  const [state, setState] = useState<SurfaceState>("loading");
  const [message, setMessage] = useState("Loading support…");
  const [categories, setCategories] = useState<SupportCategoryView[]>([]);
  const [tickets, setTickets] = useState<SupportTicketView[]>([]);
  const [open, setOpen] = useState<SupportTicketDetail | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    try {
      const [cats, list] = await Promise.all([
        createWebApiClient().listSupportCategories(),
        createWebApiClient().listSupportTickets(),
      ]);
      setCategories(cats);
      setTickets(list);
      if (categoryId === "" && cats[0] !== undefined) {
        setCategoryId(cats[0].id);
      }
      setState(list.length === 0 ? "empty" : "success");
      setMessage(
        list.length === 0
          ? "No tickets yet. Categories are loaded from the API."
          : `${list.length} tickets`,
      );
    } catch (error) {
      if (error instanceof HasutApiError && error.envelope.error.code === "UNAUTHENTICATED") {
        window.location.assign("/login");
        return;
      }
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load support.");
    }
  }, [categoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(): Promise<void> {
    setState("loading");
    try {
      const created = await createWebApiClient().createSupportTicket({
        categoryId,
        subject,
        body,
      });
      setSubject("");
      setBody("");
      setOpen(created);
      await load();
    } catch (error) {
      setState("error");
      setMessage(error instanceof HasutApiError ? error.message : "Unable to open a ticket.");
    }
  }

  return (
    <main>
      <AppNav />
      <h1>Support</h1>
      <p className="lede">
        Contact HASUT. Ticket categories come from configuration, not hardcoded UI.
      </p>
      <Surface state={state} title="Your tickets">
        <p>{message}</p>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <label>
            Category
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <input value={subject} onChange={(event) => setSubject(event.target.value)} required />
          </label>
          <label>
            Details
            <textarea value={body} onChange={(event) => setBody(event.target.value)} required />
          </label>
          <Button type="submit">Open ticket</Button>
        </form>
        <div className="stack">
          {tickets.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                void createWebApiClient().getSupportTicket(item.id).then(setOpen);
              }}
            >
              {item.subject} · {item.status}
            </button>
          ))}
        </div>
        {open !== null ? (
          <div className="stack">
            <h2>{open.subject}</h2>
            {open.messages.map((item) => (
              <p key={item.id}>
                <strong>{item.author.displayName}:</strong> {item.body}
              </p>
            ))}
            <label>
              Reply
              <textarea value={reply} onChange={(event) => setReply(event.target.value)} />
            </label>
            <Button
              variant="secondary"
              onClick={() => {
                void createWebApiClient()
                  .replySupportTicket(open.id, reply)
                  .then((sent) => {
                    setReply("");
                    setOpen({ ...open, messages: [...open.messages, sent] });
                  });
              }}
            >
              Send
            </Button>
          </div>
        ) : null}
      </Surface>
    </main>
  );
}
