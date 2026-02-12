import { Outlet } from "react-router";
import { TopNav } from "@/components/top-nav";
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

  return (
    <div className="flex flex-col h-screen">
      <TopNav />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <main className="flex-1 overflow-auto min-w-0">
          <Outlet />
        </main>
        <div
          className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "w-[420px]" : "w-0"}`}
        >
          <MessengerPanel />
        </div>
      </div>
    </div>
  );
}
