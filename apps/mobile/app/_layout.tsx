import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Tabs screenOptions={{ headerTitle: "HASUT" }}>
        <Tabs.Screen name="index" options={{ title: "Map" }} />
        <Tabs.Screen name="connections" options={{ title: "Connections" }} />
        <Tabs.Screen name="inbox" options={{ title: "Inbox" }} />
        <Tabs.Screen name="notifications" options={{ title: "Alerts" }} />
        <Tabs.Screen name="me" options={{ title: "Me" }} />
        <Tabs.Screen name="login" options={{ href: null }} />
        <Tabs.Screen name="support" options={{ href: null }} />
        <Tabs.Screen name="verification" options={{ href: null }} />
        <Tabs.Screen name="conversations/[id]" options={{ href: null }} />
      </Tabs>
    </>
  );
}
