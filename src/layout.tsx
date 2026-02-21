import { useState } from "react";
import { Outlet } from "react-router";
import { TopNav } from "@/components/top-nav";
import { StatusBar } from "@/components/status-bar";
import { LogsPanel } from "@/components/logs-panel";
import { EventsPanel } from "@/components/events-panel";
import { MessengerPanel } from "@/components/messenger/messenger-panel";
import {
  MessengerPanelProvider,
  useMessengerPanel,
} from "@/hooks/use-messenger-panel";

export default function Layout() {
  return (
    <MessengerPanelProvider>
      <LayoutInner />
    </MessengerPanelProvider>
  );
}

function LayoutInner() {
  const { isOpen } = useMessengerPanel();
  const [logsOpen, setLogsOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen dark:bg-[oklch(0.10_0.005_270)]">
      <TopNav />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <main className="flex-1 overflow-auto min-w-0 dark:bg-[oklch(0.12_0.005_270)]">
          <Outlet />
        </main>
        <div
          className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "w-[420px]" : "w-0"}`}
        >
          <MessengerPanel />
        </div>
      </div>
      {logsOpen && <LogsPanel onClose={() => setLogsOpen(false)} />}
      {eventsOpen && <EventsPanel onClose={() => setEventsOpen(false)} />}
      <StatusBar
        logsOpen={logsOpen}
        onToggleLogs={() => setLogsOpen((v) => !v)}
        eventsOpen={eventsOpen}
        onToggleEvents={() => setEventsOpen((v) => !v)}
      />
    </div>
  );
}
