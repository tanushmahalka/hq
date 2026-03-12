import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  useLocation,
  useParams,
} from "react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { GatewayProvider } from "@/hooks/use-gateway";
import { ApprovalProvider } from "@/hooks/approval-provider";
import { TRPCProvider } from "@/hooks/use-trpc";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CustomPageErrorBoundary } from "@/components/custom-page-error-boundary";
import { Toaster } from "@/components/ui/sonner";
import "./index.css";
import Layout from "./layout";
import Dashboard from "./pages/dashboard";
import Tasks from "./pages/tasks";
import Agents from "./pages/agents";
import Missions from "./pages/missions";
import Files from "./pages/files";
import Db from "./pages/db";
import Seo from "./pages/seo";
import Login from "./pages/login";
import InvitePage from "./pages/invite";
import NoAccess from "./pages/no-access";
import SettingsHome from "./pages/settings-home";
import SettingsLayout from "./pages/settings-layout";
import TeamPage from "./pages/team";
import customPages from "./pages/custom/registry";

const customRoutes = customPages.map((page) => ({
  ...page,
  Component: lazy(page.component),
}));

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? "ws://localhost:18789";
const GATEWAY_TOKEN = import.meta.env.VITE_GATEWAY_TOKEN ?? "";

function LegacyInviteRedirect() {
  const { invitationId = "" } = useParams();
  return <Navigate to={`/app/invite/${invitationId}`} replace />;
}

function LegacyNoAccessRedirect() {
  const location = useLocation();
  return <Navigate to={`/app/no-access${location.search}`} replace />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light">
      <TRPCProvider>
        <BrowserRouter>
          <Routes>
            {/* Public auth routes */}
            <Route path="app/login" element={<Login />} />
            <Route path="app/signup" element={<Navigate to="/app/login" replace />} />
            <Route
              path="app/onboarding/create-org"
              element={<Navigate to="/app/login" replace />}
            />
            <Route path="app/invite/:invitationId" element={<InvitePage />} />
            <Route
              path="app/no-access"
              element={
                <ProtectedRoute>
                  <NoAccess />
                </ProtectedRoute>
              }
            />

            {/* Legacy auth path redirects */}
            <Route path="login" element={<Navigate to="/app/login" replace />} />
            <Route path="signup" element={<Navigate to="/app/login" replace />} />
            <Route
              path="onboarding/create-org"
              element={<Navigate to="/app/login" replace />}
            />
            <Route path="invite/:invitationId" element={<LegacyInviteRedirect />} />
            <Route path="no-access" element={<LegacyNoAccessRedirect />} />

            {/* Protected app routes (auth + org required) */}
            <Route
              element={
                <ProtectedRoute requireOrg>
                  <Navigate to="/app" replace />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Navigate to="/app" replace />} />
            </Route>

            <Route
              path="app"
              element={
                <ProtectedRoute requireOrg>
                  <GatewayProvider url={GATEWAY_URL} token={GATEWAY_TOKEN}>
                    <ApprovalProvider>
                      <Layout />
                    </ApprovalProvider>
                  </GatewayProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="missions" element={<Missions />} />
              <Route path="seo" element={<Seo />} />
              <Route path="files" element={<Files />} />
              <Route path="settings" element={<SettingsLayout />}>
                <Route index element={<SettingsHome />} />
                <Route path="team" element={<TeamPage />} />
              </Route>
              <Route
                path="agents"
                element={
                  <ProtectedRoute requireAdmin>
                    <Agents />
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
      </TRPCProvider>
      <Toaster />
    </ThemeProvider>
  </StrictMode>
);
