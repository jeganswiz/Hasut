import { HasutApiError, createHasutRealtimeClient } from "@hasut/api-client";
import { DEFAULT_THEME_TOKENS } from "@hasut/config";
import type {
  ConnectionView,
  ConversationView,
  MessageView,
  NotificationView,
  ThemeTokens,
} from "@hasut/types";
import { Link, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createMobileApiClient, mobileApiBaseUrl } from "./api";
import { mobileTokenStorage } from "./token-storage";

export function ConnectionsScreen() {
  const [tokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [items, setItems] = useState<ConnectionView[]>([]);
  const [message, setMessage] = useState("Loading connections…");
  const styles = makeStyles(tokens);

  const load = useCallback(async () => {
    const data = await createMobileApiClient().listConnections();
    setItems(data);
    setMessage(data.length === 0 ? "No connections yet." : `${data.length} connections`);
  }, []);

  useEffect(() => {
    void load().catch((error: unknown) => {
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load connections.");
    });
  }, [load]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Connections</Text>
      <Text style={styles.status}>{message}</Text>
      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>{item.peer.displayName}</Text>
          <Text>
            {item.status} · {item.direction}
          </Text>
          {item.status === "PENDING" && item.direction === "INCOMING" ? (
            <View style={styles.row}>
              <Pressable
                onPress={() => void createMobileApiClient().acceptConnection(item.id).then(load)}
              >
                <Text style={styles.link}>Accept</Text>
              </Pressable>
              <Pressable
                onPress={() => void createMobileApiClient().rejectConnection(item.id).then(load)}
              >
                <Text style={styles.link}>Reject</Text>
              </Pressable>
            </View>
          ) : null}
          {item.status === "PENDING" && item.direction === "OUTGOING" ? (
            <Pressable
              onPress={() => void createMobileApiClient().cancelConnection(item.id).then(load)}
            >
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
          ) : null}
          {item.status === "ACCEPTED" && item.conversationId !== null ? (
            <Link href={`/conversations/${item.conversationId}`}>
              <Text style={styles.link}>Open chat</Text>
            </Link>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

export function InboxScreen() {
  const [tokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [items, setItems] = useState<ConversationView[]>([]);
  const [message, setMessage] = useState("Loading inbox…");
  const styles = makeStyles(tokens);

  useEffect(() => {
    void createMobileApiClient()
      .listConversations()
      .then((data) => {
        setItems(data);
        setMessage(data.length === 0 ? "No conversations yet." : `${data.length} conversations`);
      })
      .catch((error: unknown) => {
        setMessage(error instanceof HasutApiError ? error.message : "Unable to load inbox.");
      });
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Inbox</Text>
      <Text style={styles.status}>{message}</Text>
      {items.map((item) => (
        <Link key={item.id} href={`/conversations/${item.id}`}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.peer.displayName}</Text>
            <Text>{item.lastMessage?.body ?? "No messages"}</Text>
            {item.unreadCount > 0 ? <Text>{item.unreadCount} unread</Text> : null}
          </View>
        </Link>
      ))}
    </ScrollView>
  );
}

export function ConversationScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [tokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [items, setItems] = useState<MessageView[]>([]);
  const [draft, setDraft] = useState("");
  const [selfId, setSelfId] = useState<string | null>(null);
  const [title, setTitle] = useState("Chat");
  const [message, setMessage] = useState("Loading chat…");
  const styles = makeStyles(tokens);

  const loadHistory = useCallback(async () => {
    if (conversationId === undefined) {
      return;
    }
    const client = createMobileApiClient();
    const [thread, page, me] = await Promise.all([
      client.getConversation(conversationId),
      client.listMessages(conversationId),
      client.me(),
    ]);
    setTitle(thread.peer.displayName);
    setItems(page.items);
    setSelfId(me.id);
    setMessage(page.items.length === 0 ? "Say hello." : "");
    const last = page.items[page.items.length - 1];
    if (last !== undefined) {
      await client.markMessagesRead(conversationId, last.id);
    }
  }, [conversationId]);

  useEffect(() => {
    void loadHistory().catch((error: unknown) => {
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load this chat.");
    });
    if (conversationId === undefined) {
      return;
    }
    const realtime = createHasutRealtimeClient({
      baseUrl: mobileApiBaseUrl(),
      tokenStorage: mobileTokenStorage,
    });
    void realtime.connect().then((socket) => {
      socket.on("connect", () => {
        void loadHistory();
      });
      socket.on("message.created", (payload: unknown) => {
        if (isMessageView(payload) && payload.conversationId === conversationId) {
          setItems((current) =>
            current.some((item) => item.id === payload.id) ? current : [...current, payload],
          );
          void createMobileApiClient().markMessagesRead(conversationId, payload.id);
        }
      });
      socket.on("message.read", () => {
        void loadHistory();
      });
    });
    return () => realtime.disconnect();
  }, [conversationId, loadHistory]);

  async function sendText(): Promise<void> {
    if (conversationId === undefined || draft.trim().length === 0) {
      return;
    }
    try {
      const created = await createMobileApiClient().sendMessage(conversationId, {
        type: "TEXT",
        body: draft.trim(),
      });
      setDraft("");
      setItems((current) => [...current, created]);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof HasutApiError ? error.message : "Unable to send.");
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.title}>{title}</Text>
        {message.length > 0 ? <Text style={styles.status}>{message}</Text> : null}
        {items.map((item) => (
          <View key={item.id} style={[styles.card, item.senderId === selfId ? styles.mine : null]}>
            <Text>{item.body ?? item.type}</Text>
            <Text style={styles.status}>{item.readAt === null ? "Sent" : "Read"}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          style={styles.search}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
        />
        <Pressable onPress={() => void sendText()}>
          <Text style={styles.link}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function NotificationsScreen() {
  const [tokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [items, setItems] = useState<NotificationView[]>([]);
  const [message, setMessage] = useState("Loading notifications…");
  const styles = makeStyles(tokens);

  useEffect(() => {
    void createMobileApiClient()
      .listNotifications()
      .then((data) => {
        setItems(data);
        setMessage(data.length === 0 ? "No notifications yet." : `${data.length} notifications`);
      })
      .catch((error: unknown) => {
        setMessage(
          error instanceof HasutApiError ? error.message : "Unable to load notifications.",
        );
      });
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.status}>{message}</Text>
      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text>{item.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

export function LoginScreen() {
  const [tokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [message, setMessage] = useState("Sign in with phone OTP. Phone numbers stay private.");
  const styles = makeStyles(tokens);

  async function requestCode(): Promise<string | null> {
    const receipt = await createMobileApiClient().requestOtp({ phone, purpose: "LOGIN" });
    setDebugCode(receipt.debugCode ?? null);
    return receipt.debugCode ?? null;
  }

  async function sendCodeOnly(): Promise<void> {
    if (phone.trim().length === 0) {
      setMessage("Enter your phone number.");
      return;
    }
    try {
      await requestCode();
      setMessage("Enter the code sent to your phone.");
    } catch (error) {
      setMessage(error instanceof HasutApiError ? error.message : "Unable to send a code.");
    }
  }

  async function continueLogin(): Promise<void> {
    if (phone.trim().length === 0) {
      setMessage("Enter your phone number.");
      return;
    }
    try {
      let issued: string | null = null;
      try {
        issued = await requestCode();
      } catch (error) {
        const errorCode = error instanceof HasutApiError ? error.envelope.error.code : undefined;
        if (errorCode !== "OTP_RESEND_COOLDOWN" && errorCode !== "RATE_LIMITED") {
          throw error;
        }
      }
      const otp = code.trim().length > 0 ? code.trim() : (issued ?? "");
      if (otp.length === 0) {
        setMessage("Enter the code sent to your phone.");
        return;
      }
      const result = await createMobileApiClient().verifyOtp({
        phone,
        code: otp,
        purpose: "LOGIN",
      });
      await mobileTokenStorage.setSession(result.tokens);
      setMessage("Signed in. Phone number is not shown to other members.");
    } catch (error) {
      setMessage(error instanceof HasutApiError ? error.message : "Unable to sign in.");
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.status}>{message}</Text>
      <TextInput style={styles.search} value={phone} onChangeText={setPhone} placeholder="+91…" />
      <TextInput
        style={styles.search}
        value={code}
        onChangeText={setCode}
        placeholder="6-digit code"
      />
      {debugCode !== null ? <Text style={styles.status}>Development code: {debugCode}</Text> : null}
      <Pressable onPress={() => void sendCodeOnly()}>
        <Text style={styles.link}>Send code</Text>
      </Pressable>
      <Pressable onPress={() => void continueLogin()}>
        <Text style={styles.link}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

function isMessageView(value: unknown): value is MessageView {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.conversationId === "string";
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: tokens.background },
    pad: { padding: 16, gap: 10 },
    title: { fontWeight: "700", fontSize: 22, color: tokens.text },
    status: { color: tokens.mutedText },
    card: {
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.surface,
    },
    mine: { backgroundColor: tokens.primary, borderColor: tokens.primary },
    cardTitle: { fontWeight: "700", color: tokens.text },
    link: { color: tokens.primary, fontWeight: "700", marginTop: 8 },
    row: { flexDirection: "row", gap: 16 },
    composer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderColor: tokens.border,
    },
    search: {
      flex: 1,
      borderWidth: 1,
      borderColor: tokens.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: tokens.text,
    },
  });
}
