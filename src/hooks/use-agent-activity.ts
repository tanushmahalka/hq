import { useEffect, useRef, useState } from "react";
import { useGateway } from "./use-gateway";
import type { EventFrame } from "@/lib/gateway-client";

type ChatEventPayload = {
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
};

const BAR_COUNT = 24;
const DECAY_INTERVAL = 600; // ms between bar shifts
const ACTIVE_STALE_MS = 10_000;

/**
 * Tracks real-time gateway activity for a specific agent.
 * Returns a rolling array of BAR_COUNT values (0 or 1) representing
 * recent activity pulses — 1 means a websocket event was received
 * during that time slot.
 */
export function useAgentActivity(agentId: string) {
  const { subscribe } = useGateway();
  const barsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const currentSlotRef = useRef(0); // accumulates hits in current slot
  const [bars, setBars] = useState<number[]>(() =>
    new Array(BAR_COUNT).fill(0)
  );
  const [active, setActive] = useState(false);
  const clearActiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleInactive = () => {
    if (clearActiveTimerRef.current) {
      clearTimeout(clearActiveTimerRef.current);
    }
    clearActiveTimerRef.current = setTimeout(() => {
      setActive(false);
      clearActiveTimerRef.current = null;
    }, ACTIVE_STALE_MS);
  };

  // Subscribe to gateway events for this agent
  useEffect(() => {
    return subscribe((evt: EventFrame) => {
      if (evt.event !== "chat") return;
      const payload = evt.payload as ChatEventPayload | undefined;
      if (!payload?.sessionKey) return;

      // Session keys follow pattern: agent:{agentId}:...
      const parts = payload.sessionKey.split(":");
      const evtAgentId = parts[0] === "agent" ? parts[1] : null;
      if (evtAgentId !== agentId) return;

      // Mark current slot as active
      currentSlotRef.current = 1;

      if (payload.state === "delta") {
        setActive(true);
        scheduleInactive();
      } else if (
        payload.state === "final" ||
        payload.state === "aborted" ||
        payload.state === "error"
      ) {
        if (clearActiveTimerRef.current) {
          clearTimeout(clearActiveTimerRef.current);
          clearActiveTimerRef.current = null;
        }
        setActive(false);
      }
    });
  }, [subscribe, agentId]);

  // Shift bars at regular intervals
  useEffect(() => {
    const interval = setInterval(() => {
      const newBars = [...barsRef.current.slice(1), currentSlotRef.current];
      barsRef.current = newBars;
      currentSlotRef.current = 0;
      setBars(newBars);
    }, DECAY_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (clearActiveTimerRef.current) {
        clearTimeout(clearActiveTimerRef.current);
      }
    };
  }, []);

  return { bars, active };
}

/**
 * Tracks activity across ALL agents at once (more efficient than
 * calling useAgentActivity per agent).
 * Returns a Map of agentId → { bars, active }.
 */
export function useAllAgentActivity() {
  const { subscribe, agents } = useGateway();
  const dataRef = useRef(
    new Map<
      string,
      { bars: number[]; currentSlot: number; active: boolean; lastDeltaAt: number }
    >()
  );
  const [snapshot, setSnapshot] = useState<
    Map<string, { bars: number[]; active: boolean }>
  >(new Map());

  // Initialize data for each agent
  useEffect(() => {
    for (const agent of agents) {
      if (!dataRef.current.has(agent.id)) {
        dataRef.current.set(agent.id, {
          bars: new Array(BAR_COUNT).fill(0),
          currentSlot: 0,
          active: false,
          lastDeltaAt: 0,
        });
      }
    }
  }, [agents]);

  // Subscribe to all chat events
  useEffect(() => {
    return subscribe((evt: EventFrame) => {
      if (evt.event !== "chat") return;
      const payload = evt.payload as ChatEventPayload | undefined;
      if (!payload?.sessionKey) return;

      const parts = payload.sessionKey.split(":");
      const agentId = parts[0] === "agent" ? parts[1] : null;
      if (!agentId) return;

      let data = dataRef.current.get(agentId);
      if (!data) {
        data = {
          bars: new Array(BAR_COUNT).fill(0),
          currentSlot: 0,
          active: false,
          lastDeltaAt: 0,
        };
        dataRef.current.set(agentId, data);
      }

      data.currentSlot = 1;

      if (payload.state === "delta") {
        data.active = true;
        data.lastDeltaAt = Date.now();
      } else if (
        payload.state === "final" ||
        payload.state === "aborted" ||
        payload.state === "error"
      ) {
        data.active = false;
        data.lastDeltaAt = 0;
      }
    });
  }, [subscribe]);

  // Shift bars for all agents at regular intervals
  useEffect(() => {
    const interval = setInterval(() => {
      const newSnapshot = new Map<
        string,
        { bars: number[]; active: boolean }
      >();

      for (const [id, data] of dataRef.current) {
        if (
          data.active &&
          data.lastDeltaAt > 0 &&
          Date.now() - data.lastDeltaAt > ACTIVE_STALE_MS
        ) {
          data.active = false;
        }
        data.bars = [...data.bars.slice(1), data.currentSlot];
        data.currentSlot = 0;
        newSnapshot.set(id, { bars: [...data.bars], active: data.active });
      }

      setSnapshot(newSnapshot);
    }, DECAY_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return snapshot;
}
