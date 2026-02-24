import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { GatewayProvider } from "@/hooks/use-gateway";
import { TRPCProvider } from "@/hooks/use-trpc";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CustomPageErrorBoundary } from "@/components/custom-page-error-boundary";
import { Toaster } from "@/components/ui/sonner";
import "./index.css";
import Layout from "./layout";
import Dashboard from "./pages/dashboard";
import Tasks from "./pages/tasks";
import Missions from "./pages/missions";
import Files from "./pages/files";
import Db from "./pages/db";
import Login from "./pages/login";
import Signup from "./pages/signup";
import CreateOrg from "./pages/onboarding/create-org";
import customPages from "./pages/custom/registry";

const customRoutes = customPages.map((page) => ({
  ...page,
  Component: lazy(page.component),
}));

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? "ws://localhost:18789";
const GATEWAY_TOKEN = import.meta.env.VITE_GATEWAY_TOKEN ?? "";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light">
      <TRPCProvider>
        <GatewayProvider url={GATEWAY_URL} token={GATEWAY_TOKEN}>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="login" element={<Login />} />
              <Route path="signup" element={<Signup />} />

              {/* Onboarding (auth required, no org required) */}
              <Route
                path="onboarding/create-org"
                element={
                  <ProtectedRoute>
                    <CreateOrg />
                  </ProtectedRoute>
                }
              />

              {/* App routes (auth + org required) */}
              <Route
                element={
                  <ProtectedRoute requireOrg>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="missions" element={<Missions />} />
                <Route
                  path="files"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Files />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="db"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Db />
                    </ProtectedRoute>
                  }
                />
                {customRoutes.map((page) => (
                  <Route
                    key={page.id}
                    path={`custom/${page.id}`}
                    element={
                      <CustomPageErrorBoundary pageId={page.id}>
                        <Suspense
                          fallback={
                            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                              Loading…
                            </div>
                          }
                        >
                          <page.Component />
                        </Suspense>
                      </CustomPageErrorBoundary>
                    }
                  />
                ))}
              </Route>
            </Routes>
          </BrowserRouter>
        </GatewayProvider>
      </TRPCProvider>
      <Toaster />
    </ThemeProvider>
  </StrictMode>
);
