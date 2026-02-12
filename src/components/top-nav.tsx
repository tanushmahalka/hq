import { Bot, ListTodo, MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMessengerPanel } from "@/hooks/use-messenger-panel";
import { cn } from "@/lib/utils";

const navLinks = [{ to: "/tasks", label: "Tasks", icon: ListTodo }] as const;

export function TopNav() {
  const location = useLocation();
  const { isOpen, toggle } = useMessengerPanel();

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
      </div>
    </header>
  );
}
