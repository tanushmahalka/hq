import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  GatewayClient,
  type EventFrame,
  type HelloOk,
} from "@/lib/gateway-client";

export type Agent = {
  id: string;
  name?: string;
  identity?: { name?: string; emoji?: string; theme?: string; avatar?: string };
};

type GatewayState = {
  client: GatewayClient | null;
  connected: boolean;
  snapshot: unknown | null;
  agents: Agent[];
};

type AgentsListResult = {
  defaultId: string;
  agents: Agent[];
};

type GatewayContextValue = GatewayState & {
  subscribe: (handler: (evt: EventFrame) => void) => () => void;
};

const GatewayContext = createContext<GatewayContextValue | null>(null);

export function GatewayProvider({
  url,
  token,
  children,
}: {
  url: string;
  token: string;
  children: ReactNode;
}) {
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<unknown | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const clientRef = useRef<GatewayClient | null>(null);

  // Event subscribers — components register handlers for real-time events
  const subscribersRef = useRef(new Set<(evt: EventFrame) => void>());

  const subscribe = useCallback((handler: (evt: EventFrame) => void) => {
    subscribersRef.current.add(handler);
    return () => {
      subscribersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    const client = new GatewayClient({
      url,
      token,
      onHello: (hello: HelloOk) => {
        setConnected(true);
        setSnapshot(hello.snapshot ?? null);
        client
          .request<AgentsListResult>("agents.list")
          .then((res) => {
            const list = res.agents ?? [];
            setAgents(list);
          })
          .catch(() => {});
      },
      onEvent: (evt: EventFrame) => {
        for (const handler of subscribersRef.current) {
          handler(evt);
        }
      },
      onClose: () => {
        setConnected(false);
      },
    });

    clientRef.current = client;
    client.start();

    return () => {
      client.stop();
      clientRef.current = null;
    };
  }, [url, token]);

  return (
    <GatewayContext.Provider
      value={{ client: clientRef.current, connected, snapshot, agents, subscribe }}
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
