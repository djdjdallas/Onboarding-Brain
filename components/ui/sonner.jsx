"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner";
import { Loader2Icon } from "lucide-react"

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="bottom-right"
      // Calm aesthetic: no status icons (PRD), only the loading spinner.
      icons={{
        success: null,
        info: null,
        warning: null,
        error: null,
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)"
        }
      }
      toastOptions={{
        duration: 2000,
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props} />
  );
}

export { Toaster }
