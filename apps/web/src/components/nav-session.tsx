"use client";

import type { OwnerMemberProfile, UnreadCountView } from "@hasut/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createWebApiClient } from "../lib/api";
import type { NavSession } from "../lib/member-nav";
import { loadNavProfile } from "../lib/session-profile";
import { webTokenStorage } from "../lib/token-storage";

export interface NavSessionValue {
  session: NavSession;
  profile: OwnerMemberProfile | null;
  unread: UnreadCountView;
  search: ReactNode;
  setSearch: (node: ReactNode) => void;
  refresh: () => Promise<void>;
}

const EMPTY_UNREAD: UnreadCountView = { notifications: 0, messages: 0 };

const NavSessionContext = createContext<NavSessionValue | null>(null);

export function NavSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<NavSession>("unknown");
  const [profile, setProfile] = useState<OwnerMemberProfile | null>(null);
  const [unread, setUnread] = useState<UnreadCountView>(EMPTY_UNREAD);
  const [search, setSearch] = useState<ReactNode>(null);

  const refresh = useCallback(async () => {
    const client = createWebApiClient();
    const next = await loadNavProfile({
      getAccessToken: () => webTokenStorage.getAccessToken(),
      getRefreshToken: () => webTokenStorage.getRefreshToken(),
      readProfile: () => client.getMyProfile(),
      refresh: (refreshToken) => client.refresh({ refreshToken }),
      save: (tokens) => webTokenStorage.setSession(tokens),
    });
    setProfile(next);
    setSession(next === null ? "guest" : "member");
    if (next === null) {
      setUnread(EMPTY_UNREAD);
      return;
    }
    try {
      setUnread(await client.getUnreadCount());
    } catch {
      setUnread(EMPTY_UNREAD);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ session, profile, unread, search, setSearch, refresh }),
    [session, profile, unread, search, refresh],
  );

  return <NavSessionContext.Provider value={value}>{children}</NavSessionContext.Provider>;
}

export function useNavSession(): NavSessionValue {
  const value = useContext(NavSessionContext);
  if (value === null) {
    throw new Error("useNavSession must be used within NavSessionProvider");
  }
  return value;
}
