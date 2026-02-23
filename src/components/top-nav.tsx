import {
  Bot,
  Database,
  FolderOpen,
  ListTodo,
  MessageCircle,
  LogOut,
  Eye,
  EyeOff,
} from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import { Link, useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMessengerPanel } from "@/hooks/use-messenger-panel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession, signOut } from "@/lib/auth-client";
import { AdminOnly } from "@/components/auth/admin-only";
import { useAdminView } from "@/hooks/use-admin-view";
import { cn } from "@/lib/utils";
import customPages from "@/pages/custom/registry";

const baseNavLinks = [
  { to: "/tasks", label: "Tasks", icon: ListTodo },
] as const;

const adminNavLinks = [
  { to: "/files", label: "Files", icon: FolderOpen },
  { to: "/db", label: "Db", icon: Database },
] as const;

export function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isOpen, toggle } = useMessengerPanel();
  const { data: session } = useSession();
  const { isAdminView, setIsAdminView } = useAdminView();

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  function NavLink({
    to,
    label,
    icon: Icon,
    iconName,
  }: {
    to: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    iconName?: string;
  }) {
    return (
      <Link
        to={to}
        className={cn(
          "flex items-center gap-1.5 px-3 h-full text-sm font-medium border-b-2 transition-colors",
          location.pathname === to
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        {Icon ? (
          <Icon className="size-4" />
        ) : iconName ? (
          <DynamicIcon name={iconName as never} className="size-4" />
        ) : null}
        {label}
      </Link>
    );
  }

  return (
    <header className="h-12 border-b px-4 flex items-center gap-6 shrink-0">
      <Link to="/" className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.65_0.18_280)] to-[oklch(0.68_0.15_245)] text-white shadow-sm">
          <Bot className="size-4" />
        </div>
        <span className="font-medium text-sm tracking-wide">HQ</span>
      </Link>

      <nav className="flex items-center gap-1 h-full">
        {baseNavLinks.map((link) => (
          <NavLink key={link.to} {...link} />
        ))}
        {customPages.map((page) => (
          <NavLink
            key={page.id}
            to={`/custom/${page.id}`}
            label={page.label}
            iconName={page.icon}
          />
        ))}
        <AdminOnly>
          {adminNavLinks.map((link) => (
            <NavLink key={link.to} {...link} />
          ))}
        </AdminOnly>
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          onClick={toggle}
          className={cn("h-8 gap-2 px-2.5", isOpen && "bg-muted")}
        >
          <MessageCircle className="size-4" />
          <Kbd className="hidden sm:inline-flex">&#8984;K</Kbd>
        </Button>
        <ThemeToggle />

        {session && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
                <Avatar className="size-7">
                  <AvatarFallback className="text-xs">
                    {getInitials(session.user.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {session.user.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {session.user.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {session.user.role === "admin" && (
                <DropdownMenuItem onClick={() => setIsAdminView(!isAdminView)}>
                  {isAdminView ? (
                    <EyeOff className="mr-2 size-4" />
                  ) : (
                    <Eye className="mr-2 size-4" />
                  )}
                  {isAdminView ? "View as User" : "View as Admin"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
