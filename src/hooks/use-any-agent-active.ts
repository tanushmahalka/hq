import { useEffect, useState } from "react";
import { useGateway } from "./use-gateway";

export function useAnyAgentActive() {
  const { subscribe } = useGateway();
  const [active, setActive] = useState(false);

  useEffect(() => {
    return subscribe((event) => {
      if (event.event === "run_started") {
        setActive(true);
        return;
      }

      if (event.event === "run_finished" || event.event === "run_error") {
        setActive(false);
      }
    });
  }, [subscribe]);

  return active;
}
