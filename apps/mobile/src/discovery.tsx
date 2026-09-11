import {
  HasutApiError,
  createHasutDiscoveryRealtimeClient,
  hasutErrorCode,
  parseDiscoveryPresenceUpdated,
  type HasutRealtimeClient,
} from "@hasut/api-client";
import { DEFAULT_THEME_TOKENS } from "@hasut/config";
import {
  DISCOVERY_PRESENCE_EVENT,
  type DiscoveryCard,
  type DiscoveryPolicyView,
  type DiscoveryResult,
  type ThemeTokens,
} from "@hasut/types";
import { mergePresenceMarker, shouldAcceptLocationFix } from "@hasut/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createMobileApiClient } from "./api";
import { mobileTokenStorage } from "./token-storage";

type GpsState = "prompt" | "granted" | "denied" | "unavailable";

interface DeviceCoords {
  latitude: number;
  longitude: number;
}

interface DeviceGeolocation {
  getCurrentPosition: (
    ok: (position: { coords: DeviceCoords }) => void,
    err: () => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
  ) => void;
  watchPosition?: (
    ok: (position: { coords: DeviceCoords }) => void,
    err: () => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
  ) => number;
  clearWatch?: (id: number) => void;
}

function readDeviceGeolocation(): DeviceGeolocation | null {
  const candidate = (
    globalThis as {
      navigator?: {
        geolocation?: DeviceGeolocation;
      };
    }
  ).navigator?.geolocation;
  if (candidate?.getCurrentPosition === undefined) {
    return null;
  }
  return candidate;
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
  const [coords, setCoords] = useState<DeviceCoords | null>(null);
  const acceptedRef = useRef<DeviceCoords | null>(null);
  const acceptedAtRef = useRef<number | null>(null);
  const resultRef = useRef<DiscoveryResult | null>(null);
  const permissionGrantedRef = useRef(false);
  const styles = makeStyles(tokens);
  resultRef.current = result;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const client = createMobileApiClient();
        const [theme, nextPolicy] = await Promise.all([
          client.theme(),
          client.getDiscoveryPolicy(),
        ]);
        if (cancelled) {
          return;
        }
        setTokens(theme.tokens);
        setPolicy(nextPolicy);
      } catch {
        if (!cancelled) {
          setMessage("Unable to load discovery configuration.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistLocation = useCallback(async (next: DeviceCoords) => {
    const token = await mobileTokenStorage.getAccessToken();
    if (token === null) {
      return;
    }
    const client = createMobileApiClient();
    try {
      if (!permissionGrantedRef.current) {
        await client.patchLocationPermission({ status: "GRANTED" });
        permissionGrantedRef.current = true;
      }
      await client.putMyLocation(next);
    } catch (error) {
      if (hasutErrorCode(error) === "RATE_LIMITED") {
        return;
      }
    }
  }, []);

  useEffect(() => {
    if (policy === null) {
      return;
    }
    const geolocation = readDeviceGeolocation();
    if (geolocation === null) {
      setGps("unavailable");
      const demo = { latitude: policy.demoLatitude, longitude: policy.demoLongitude };
      acceptedRef.current = demo;
      acceptedAtRef.current = Date.now();
      setCoords(demo);
      setMessage("Showing the seeded demo neighborhood.");
      return;
    }

    const onFix = (position: { coords: DeviceCoords }) => {
      const next = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setGps("granted");
      const accept = shouldAcceptLocationFix({
        previous: acceptedRef.current,
        next,
        lastAcceptedAtMs: acceptedAtRef.current,
        nowMs: Date.now(),
        significantMoveMeters: policy.significantMoveMeters,
        minUpdateIntervalSeconds: policy.minUpdateIntervalSeconds,
      });
      if (!accept) {
        return;
      }
      acceptedRef.current = next;
      acceptedAtRef.current = Date.now();
      setCoords(next);
      void persistLocation(next);
    };

    const options = {
      enableHighAccuracy: true,
      timeout: policy.geolocationTimeoutMs,
      maximumAge: policy.minUpdateIntervalSeconds * 1000,
    };

    if (geolocation.watchPosition !== undefined) {
      const watchId = geolocation.watchPosition(onFix, () => setGps("denied"), options);
      return () => geolocation.clearWatch?.(watchId);
    }

    geolocation.getCurrentPosition(onFix, () => setGps("denied"), options);
    return undefined;
  }, [persistLocation, policy]);

  useEffect(() => {
    if (coords !== null || policy === null) {
      return;
    }
    if (gps === "denied" || gps === "unavailable") {
      const demo = { latitude: policy.demoLatitude, longitude: policy.demoLongitude };
      acceptedRef.current = demo;
      setCoords(demo);
      setMessage("Showing the seeded demo neighborhood.");
    }
  }, [coords, gps, policy]);

  useEffect(() => {
    if (coords === null || policy === null) {
      return;
    }
    const timer = setTimeout(() => {
      void createMobileApiClient()
        .nearby({
          latitude: coords.latitude,
          longitude: coords.longitude,
          radiusMeters: policy.defaultRadiusMeters,
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
          if (resultRef.current !== null) {
            return;
          }
          setMessage(
            error instanceof HasutApiError ? error.message : "Network failure. Try again.",
          );
        });
    }, policy.searchDebounceMs);
    return () => clearTimeout(timer);
  }, [available, coords, policy, query, verified]);

  useEffect(() => {
    if (policy === null) {
      return;
    }
    let cancelled = false;
    let realtime: HasutRealtimeClient | null = null;
    void mobileTokenStorage.getAccessToken().then((token) => {
      if (cancelled || token === null) {
        return;
      }
      realtime = createHasutDiscoveryRealtimeClient({
        baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001",
        tokenStorage: mobileTokenStorage,
      });
      void realtime.connect().then((socket) => {
        socket.on(DISCOVERY_PRESENCE_EVENT, (payload: unknown) => {
          const parsed = parseDiscoveryPresenceUpdated(payload);
          if (parsed === null) {
            return;
          }
          setResult((current) =>
            current === null
              ? current
              : { ...current, markers: mergePresenceMarker(current.markers, parsed.marker) },
          );
        });
        realtime?.emit("presence.sync");
      });
    });
    return () => {
      cancelled = true;
      realtime?.disconnect();
    };
  }, [policy]);

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
                const demo = { latitude: policy.demoLatitude, longitude: policy.demoLongitude };
                acceptedRef.current = demo;
                acceptedAtRef.current = Date.now();
                setCoords(demo);
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
