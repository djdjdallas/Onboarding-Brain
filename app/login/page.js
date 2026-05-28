"use client"

import { useActionState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

import { sendMagicLink } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">SEO Page Manager</CardTitle>
          <CardDescription>
            Sign in with your work email. We&apos;ll send you a magic link —
            no password needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-4">
            <div className="grid gap-2">
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
            {state?.success ? (
              <p className="text-sm text-muted-foreground">{state.success}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
