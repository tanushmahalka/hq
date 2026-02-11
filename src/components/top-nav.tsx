import { Bot, ListTodo } from "lucide-react";
import { Link, useLocation } from "react-router";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const navLinks = [{ to: "/tasks", label: "Tasks", icon: ListTodo }] as const;

export function TopNav() {
  const location = useLocation();

  return (
    <header className="h-12 border-b px-4 flex items-center gap-6 shrink-0">
      <Link to="/" className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Bot className="size-4" />
        </div>
        <span className="font-semibold text-sm">HQ</span>
      </Link>

      <nav className="flex items-center gap-1 h-full">
        {navLinks.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex items-center gap-1.5 px-3 h-full text-sm font-medium border-b-2 transition-colors",
              location.pathname === to
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
