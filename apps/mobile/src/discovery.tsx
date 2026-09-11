import { HasutApiError } from "@hasut/api-client";
import { DEFAULT_THEME_TOKENS } from "@hasut/config";
import type {
  DiscoveryCard,
  DiscoveryPolicyView,
  DiscoveryResult,
  ThemeTokens,
} from "@hasut/types";
import { useCallback, useEffect, useState } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createMobileApiClient } from "./api";

type GpsState = "prompt" | "granted" | "denied" | "unavailable";

interface DeviceCoords {
  latitude: number;
  longitude: number;
}

function readDeviceGeolocation(): {
  getCurrentPosition: (ok: (position: { coords: DeviceCoords }) => void, err: () => void) => void;
} | null {
  const candidate = (
    globalThis as {
      navigator?: {
        geolocation?: {
          getCurrentPosition?: (
            ok: (position: { coords: DeviceCoords }) => void,
            err: () => void,
          ) => void;
        };
      };
    }
  ).navigator?.geolocation;
  if (candidate?.getCurrentPosition === undefined) {
    return null;
  }
  return { getCurrentPosition: candidate.getCurrentPosition };
}

export function DiscoveryScreen() {
  const [tokens, setTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [policy, setPolicy] = useState<DiscoveryPolicyView | null>(null);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [query, setQuery] = useState("");
  const [verified, setVerified] = useState(false);
  const [available, setAvailable] = useState(false);
  const [selected, setSelected] = useState<DiscoveryCard | null>(null);
  const [gps, setGps] = useState<GpsState>("prompt");
  const [message, setMessage] = useState("Finding what’s nearby…");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const styles = makeStyles(tokens);

  const load = useCallback(async () => {
    const client = createMobileApiClient();
    try {
      const [theme, nextPolicy] = await Promise.all([client.theme(), client.getDiscoveryPolicy()]);
      setTokens(theme.tokens);
      setPolicy(nextPolicy);
    } catch {
      setMessage("Unable to load discovery configuration.");
    }
  }, []);

  useEffect(() => {
    void load();
    const geolocation = readDeviceGeolocation();
    if (geolocation === null) {
      setGps("unavailable");
      return;
    }
    geolocation.getCurrentPosition(
      (position) => {
        setGps("granted");
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      () => {
        setGps("denied");
      },
    );
  }, [load]);

  useEffect(() => {
    if (coords !== null || policy === null) {
      return;
    }
    if (gps === "denied" || gps === "unavailable") {
      setCoords({ latitude: policy.demoLatitude, longitude: policy.demoLongitude });
      setMessage("Showing the seeded demo neighborhood.");
    }
  }, [coords, gps, policy]);

  useEffect(() => {
    if (coords === null) {
      return;
    }
    void createMobileApiClient()
      .nearby({
        latitude: coords.latitude,
        longitude: coords.longitude,
        radiusMeters: policy?.defaultRadiusMeters,
        verified: verified ? true : undefined,
        available: available ? true : undefined,
        q: query.trim().length === 0 ? undefined : query.trim(),
      })
      .then((data) => {
        setResult(data);
        setMessage(
          data.items.length === 0
            ? "No nearby results in this area."
            : `${data.items.length} nearby results`,
        );
      })
      .catch((error: unknown) => {
        setMessage(error instanceof HasutApiError ? error.message : "Network failure. Try again.");
      });
  }, [available, coords, policy?.defaultRadiusMeters, query, verified]);

  return (
    <View style={styles.screen}>
      <View style={styles.map}>
        {(result?.markers ?? []).map((marker) => (
          <View key={marker.id} style={styles.pin}>
            <Text style={styles.pinText}>
              ★ {marker.rating === null ? "New" : marker.rating.toFixed(1)}
            </Text>
          </View>
        ))}
        {(result?.clusters ?? []).map((cluster) => (
          <View key={cluster.id} style={styles.cluster}>
            <Text style={styles.clusterText}>{cluster.count}</Text>
          </View>
        ))}
      </View>
      <View style={styles.sheet}>
        <TextInput
          style={styles.search}
          placeholder="Search service"
          value={query}
          onChangeText={setQuery}
        />
        <Text style={styles.status}>{message}</Text>
        <View style={styles.row}>
          <Link href="/connections">
            <Text style={styles.chipLabel}>Connections</Text>
          </Link>
          <Link href="/inbox">
            <Text style={styles.chipLabel}>Inbox</Text>
          </Link>
          <Link href="/notifications">
            <Text style={styles.chipLabel}>Notifications</Text>
          </Link>
          <Link href="/login">
            <Text style={styles.chipLabel}>Sign in</Text>
          </Link>
          {policy !== null ? (
            <Pressable
              onPress={() => {
                setCoords({ latitude: policy.demoLatitude, longitude: policy.demoLongitude });
                setMessage("Showing the seeded demo neighborhood.");
              }}
            >
              <Text style={styles.chipLabel}>Seeded area</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.row}>
          <Pressable
            style={[styles.chip, verified ? styles.chipActive : null]}
            onPress={() => setVerified((v) => !v)}
          >
            <Text style={verified ? styles.chipActiveLabel : styles.chipLabel}>Verified</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, available ? styles.chipActive : null]}
            onPress={() => setAvailable((v) => !v)}
          >
            <Text style={available ? styles.chipActiveLabel : styles.chipLabel}>Available</Text>
          </Pressable>
        </View>
        <ScrollView horizontal>
          {(result?.items ?? []).map((item) => (
            <Pressable
              key={`${item.kind}-${item.id}`}
              style={[styles.card, selected?.id === item.id ? styles.cardActive : null]}
              onPress={() => setSelected(item)}
            >
              <Text style={selected?.id === item.id ? styles.cardActiveTitle : styles.cardTitle}>
                {item.title}
              </Text>
              <Text style={styles.accent}>
                ★ {item.rating === null ? "New" : item.rating.toFixed(1)}
              </Text>
              <Text>{item.distanceBucket}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {selected !== null ? (
          <View style={styles.preview}>
            <Text style={styles.cardTitle}>{selected.title}</Text>
            <Text>{selected.subtitle}</Text>
            <Text>
              {selected.verified ? "Verified · " : ""}
              {selected.available ? "Available" : ""}
            </Text>
          </View>
        ) : null}
        {gps === "denied" ? <Text>Enable location to discover nearby people.</Text> : null}
      </View>
    </View>
  );
}

function makeStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: tokens.background },
    map: {
      flex: 1,
      backgroundColor: tokens.background,
      padding: 24,
      flexDirection: "row",
      flexWrap: "wrap",
    },
    sheet: {
      backgroundColor: tokens.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 16,
      gap: 10,
    },
    search: {
      borderWidth: 1,
      borderColor: tokens.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: tokens.text,
    },
    status: { color: tokens.mutedText },
    row: { flexDirection: "row", gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: tokens.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipActive: { backgroundColor: tokens.primary, borderColor: tokens.primary },
    chipLabel: { color: tokens.text, fontWeight: "600" },
    chipActiveLabel: { color: tokens.textOnPrimary, fontWeight: "600" },
    card: {
      width: 140,
      marginRight: 10,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.surface,
    },
    cardActive: { backgroundColor: tokens.primary, borderColor: tokens.primary },
    cardTitle: { fontWeight: "700", color: tokens.text },
    cardActiveTitle: { fontWeight: "700", color: tokens.textOnPrimary },
    accent: { color: tokens.accent, fontWeight: "700" },
    pin: {
      backgroundColor: tokens.surface,
      borderColor: tokens.primary,
      borderWidth: 3,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      margin: 6,
    },
    pinText: { fontWeight: "700", color: tokens.text },
    cluster: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: tokens.primary,
      alignItems: "center",
      justifyContent: "center",
      margin: 6,
    },
    clusterText: { color: tokens.textOnPrimary, fontWeight: "700" },
    preview: { paddingTop: 8 },
  });
}
