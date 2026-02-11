import { Outlet } from "react-router";
import { TopNav } from "@/components/top-nav";
import { FloatingMessenger } from "@/components/messenger/messenger-dock";

export default function Layout() {
  return (
    <div className="flex flex-col h-screen">
      <TopNav />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <FloatingMessenger />
    </div>
  );
}
