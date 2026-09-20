"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export function GetStartedButton({
  className,
  variant = "hero",
}: {
  className?: string;
  variant?: "hero" | "navbar";
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setIsAuthenticated(Boolean(data?.authenticated && data?.user));
      })
      .catch(() => setIsAuthenticated(false));
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isAuthenticated) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  };

  if (variant === "navbar") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={
          className ||
          "text-xs font-medium bg-foreground text-background px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity cursor-pointer"
        }
      >
        Get Started
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        className ||
        "inline-flex h-11 items-center gap-2 rounded-lg bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90 cursor-pointer"
      }
    >
      <span>Get Started</span>
      <ArrowRight className="size-4" />
    </button>
  );
}
