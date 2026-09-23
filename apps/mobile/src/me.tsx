import { HasutApiError } from "@hasut/api-client";
import { DEFAULT_THEME_TOKENS } from "@hasut/config";
import type { OwnerMemberProfile, ThemeTokens } from "@hasut/types";
import { useCallback, useEffect, useState } from "react";
import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { createMobileApiClient } from "./api";

export function MeScreen() {
  const [tokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [profile, setProfile] = useState<OwnerMemberProfile | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("Loading profile…");
  const styles = makeStyles(tokens);

  const load = useCallback(async () => {
    try {
      const mine = await createMobileApiClient().getMyProfile();
      setProfile(mine);
      setName(mine.displayName);
      setMessage("Edit your public profile. Phone stays private.");
    } catch (error) {
      setMessage(error instanceof HasutApiError ? error.message : "Sign in to edit your profile.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Me</Text>
      <Text style={styles.status}>{message}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Display name"
      />
      <Pressable
        style={styles.button}
        onPress={() => {
          void createMobileApiClient()
            .putMyProfile({ displayName: name, bio: profile?.bio ?? "" })
            .then(load);
        }}
      >
        <Text style={styles.buttonLabel}>Save</Text>
      </Pressable>
      <Link href={"/story" as Href}>
        <Text style={styles.link}>Add presence</Text>
      </Link>
      {profile !== null ? (
        <Link href={`/stories/${profile.id}` as Href}>
          <Text style={styles.link}>Watch my presence</Text>
        </Link>
      ) : null}
    </View>
  );
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    screen: { flex: 1, padding: 16, gap: 12, backgroundColor: tokens.background },
    title: { fontSize: 24, fontWeight: "700", color: tokens.text },
    status: { color: tokens.mutedText },
    input: {
      borderWidth: 1,
      borderColor: tokens.border,
      borderRadius: 12,
      padding: 12,
      color: tokens.text,
    },
    button: {
      backgroundColor: tokens.primary,
      borderRadius: 14,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonLabel: { color: tokens.textOnPrimary, fontWeight: "700" },
    link: { color: tokens.text, fontWeight: "600" },
  });
}
