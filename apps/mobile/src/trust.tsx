import { HasutApiError } from "@hasut/api-client";
import { DEFAULT_THEME_TOKENS } from "@hasut/config";
import type {
  IdentityVerificationRequest,
  SupportCategoryView,
  SupportTicketView,
  ThemeTokens,
} from "@hasut/types";
import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createMobileApiClient } from "./api";

export function VerificationScreen() {
  const [tokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [request, setRequest] = useState<IdentityVerificationRequest | null>(null);
  const [message, setMessage] = useState("Loading identity verification…");
  const styles = makeStyles(tokens);

  useEffect(() => {
    void createMobileApiClient()
      .getIdentityVerification()
      .then((data) => {
        setRequest(data);
        setMessage(
          data.status === "VERIFIED"
            ? "Identity verified. This is not a skill verification."
            : `Identity status: ${data.status}`,
        );
      })
      .catch((error: unknown) => {
        if (error instanceof HasutApiError && error.envelope.error.code === "NOT_FOUND") {
          setMessage("No identity request yet. Start from professional onboarding on web.");
          return;
        }
        setMessage(error instanceof HasutApiError ? error.message : "Unable to load verification.");
      });
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Identity verification</Text>
      <Text style={styles.status}>{message}</Text>
      {request?.reviewNote ? <Text>Reviewer note: {request.reviewNote}</Text> : null}
    </ScrollView>
  );
}

export function SupportScreen() {
  const [tokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [message, setMessage] = useState("Loading support…");
  const [categories, setCategories] = useState<SupportCategoryView[]>([]);
  const [tickets, setTickets] = useState<SupportTicketView[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const styles = makeStyles(tokens);

  const load = useCallback(async () => {
    const [cats, list] = await Promise.all([
      createMobileApiClient().listSupportCategories(),
      createMobileApiClient().listSupportTickets(),
    ]);
    setCategories(cats);
    setTickets(list);
    if (cats[0] !== undefined) {
      setCategoryId(cats[0].id);
    }
    setMessage(list.length === 0 ? "No tickets yet." : `${list.length} tickets`);
  }, []);

  useEffect(() => {
    void load().catch((error: unknown) => {
      setMessage(error instanceof HasutApiError ? error.message : "Unable to load support.");
    });
  }, [load]);

  async function create(): Promise<void> {
    try {
      await createMobileApiClient().createSupportTicket({ categoryId, subject, body });
      setSubject("");
      setBody("");
      await load();
    } catch (error) {
      setMessage(error instanceof HasutApiError ? error.message : "Unable to open a ticket.");
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Support</Text>
      <Text style={styles.status}>{message}</Text>
      <TextInput
        style={styles.search}
        value={subject}
        onChangeText={setSubject}
        placeholder="Subject"
      />
      <TextInput
        style={styles.search}
        value={body}
        onChangeText={setBody}
        placeholder="Details"
        multiline
      />
      <Pressable onPress={() => void create()}>
        <Text style={styles.link}>
          Open ticket{categories[0] ? ` in ${categories[0].name}` : ""}
        </Text>
      </Pressable>
      {tickets.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>{item.subject}</Text>
          <Text>
            {item.status} · {item.category.name}
          </Text>
        </View>
      ))}
      <Link href="/">
        <Text style={styles.link}>Back to map</Text>
      </Link>
    </ScrollView>
  );
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
    cardTitle: { fontWeight: "700", color: tokens.text },
    link: { color: tokens.primary, fontWeight: "700", marginTop: 8 },
    search: {
      borderWidth: 1,
      borderColor: tokens.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: tokens.text,
    },
  });
}
