import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GatewayProvider } from "@/hooks/use-gateway";
import "./index.css";
import Layout from "./layout";
import Dashboard from "./pages/dashboard";
import AgentChat from "./pages/agent-chat";

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? "ws://localhost:18789";
const GATEWAY_TOKEN = import.meta.env.VITE_GATEWAY_TOKEN ?? "";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        <GatewayProvider url={GATEWAY_URL} token={GATEWAY_TOKEN}>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="agent/:agentId" element={<AgentChat />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </GatewayProvider>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
);
