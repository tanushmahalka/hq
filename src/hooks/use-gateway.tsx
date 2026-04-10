/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import type { EventFrame, GatewayClient } from "@/lib/gateway-client";

export type Agent = {
  id: string;
  name?: string;
  apiUrl?: string;
  identity?: { name?: string; emoji?: string; theme?: string; avatar?: string };
};

type GatewayState = {
  client: GatewayClient | null;
  connected: boolean;
  snapshot: unknown | null;
  agents: Agent[];
  methods: string[];
};

type GatewayContextValue = GatewayState & {
  subscribe: (handler: (evt: EventFrame) => void) => () => void;
};

const GatewayContext = createContext<GatewayContextValue | null>(null);

const HARDCODED_AGENTS: Agent[] = [
  {
    id: "kaira",
    name: "Kaira",
    apiUrl: "https://hermes-kfd.voxxi.ai/v1",
    identity: {
      name: "Kaira",
    },
  },
];

export function GatewayProvider({
  children,
}: {
  children: ReactNode;
}) {
  const agents = HARDCODED_AGENTS;

  const subscribe = useCallback((handler: (evt: EventFrame) => void) => {
    void handler;
    return () => {};
  }, []);

  return (
    <GatewayContext.Provider
      value={{
        client: null as GatewayClient | null,
        connected: false,
        snapshot: null,
        agents,
        methods: [],
        subscribe,
      }}
    >
      {children}
    </GatewayContext.Provider>
  );
}

export function useGateway() {
  const ctx = useContext(GatewayContext);
  if (!ctx) throw new Error("useGateway must be used within GatewayProvider");
  return ctx;
}
