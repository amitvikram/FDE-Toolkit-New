"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

export type User = {
  subject: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
};

type UserContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

const UserContext = createContext<UserContextValue | null>(null);
const siteOnly = process.env.NEXT_PUBLIC_SITE_ONLY === "true";

function PublicSiteUserProvider({ children }: { children: ReactNode }) {
  return (
    <UserContext.Provider
      value={{
        user: null,
        isLoading: false,
        isAuthenticated: false,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

function ConnectedUserProvider({ children }: { children: ReactNode }) {
  const identity = useQuery(api.auth.getCurrentUser);
  const isLoading = identity === undefined;
  const user = (identity as User | null | undefined) ?? null;
  const isAuthenticated = user !== null;

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function UserProvider({ children }: { children: ReactNode }) {
  if (siteOnly) {
    return <PublicSiteUserProvider>{children}</PublicSiteUserProvider>;
  }

  return <ConnectedUserProvider>{children}</ConnectedUserProvider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (ctx === null) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
}

export function useUserOptional(): UserContextValue {
  const ctx = useContext(UserContext);
  if (ctx === null) {
    return {
      user: null,
      isLoading: true,
      isAuthenticated: false,
    };
  }
  return ctx;
}
