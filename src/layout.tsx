import { useState } from "react";
import { Outlet } from "react-router";
import { TopNav } from "@/components/top-nav";
import { StatusBar } from "@/components/status-bar";
import { LogsPanel } from "@/components/logs-panel";
import { EventsPanel } from "@/components/events-panel";
import { ChatPanel } from "@/components/messenger/messenger-panel";
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
  const { chatOpen } = useMessengerPanel();
  const [logsOpen, setLogsOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-background">
      <TopNav />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <main className="flex-1 overflow-auto min-w-0 bg-background">
          <Outlet />
        </main>

        {/* Chat panel — slides in/out */}
        <div
          className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${chatOpen ? "w-[420px]" : "w-0"}`}
        >
          <ChatPanel />
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
