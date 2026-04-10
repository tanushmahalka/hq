import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MessengerPanelProvider,
  useMessengerPanel,
} from "./use-messenger-panel";

vi.mock("@uidotdev/usehooks", () => ({
  useLocalStorage: <T,>(key: string, initialValue: T) => {
    const [value, setValue] = useState<T>(initialValue);

    const updateValue = (
      next: T | ((previous: T) => T),
    ) => {
      setValue((previous) => {
        const resolved =
          typeof next === "function"
            ? (next as (previous: T) => T)(previous)
            : next;
        localStorage.setItem(key, JSON.stringify(resolved));
        return resolved;
      });
    };

    return [value, updateValue] as const;
  },
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <MessengerPanelProvider>{children}</MessengerPanelProvider>;
}

describe("useMessengerPanel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("toggles the chat open state", async () => {
    const { result } = renderHook(() => useMessengerPanel(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.toggleChat();
    });

    await waitFor(() => {
      expect(result.current.chatOpen).toBe(true);
      expect(localStorage.getItem("hq:messenger:open")).toBe(
        JSON.stringify(true),
      );
    });

    act(() => {
      result.current.closeChat();
    });

    await waitFor(() => {
      expect(result.current.chatOpen).toBe(false);
      expect(localStorage.getItem("hq:messenger:open")).toBe(
        JSON.stringify(false),
      );
    });
  });
});
