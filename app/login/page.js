"use client"

import { useActionState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

import { sendMagicLink } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Sending…" : "Send magic link"}
    </Button>
  )
}

export default function LoginPage() {
  const [state, formAction] = useActionState(sendMagicLink, null)

  // Surface the server action result as a toast.
  useEffect(() => {
    if (state?.error) toast.error(state.error)
    if (state?.success) toast.success(state.success)
  }, [state])

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-80 space-y-6">
        <div className="space-y-3 text-center">
          <span className="mx-auto grid size-[22px] place-items-center rounded-[5px] bg-primary text-[11px] font-medium text-primary-foreground">
            S
          </span>
          <div className="space-y-1">
            <h1 className="text-h1 font-medium tracking-tight">Welcome back</h1>
            <p className="text-small text-muted-foreground">
              Sign in to SEO Page Manager with your work email.
            </p>
          </div>
        </div>

        <form action={formAction} className="space-y-3">
          <div className="grid gap-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@agency.com"
              autoComplete="email"
              required
            />
          </div>
          <SubmitButton />
        </form>

        <p className="text-center text-tiny text-muted-foreground">
          {state?.success
            ? state.success
            : "We'll email you a sign-in link — no password needed."}
        </p>
      </div>
    </main>
  )
}
