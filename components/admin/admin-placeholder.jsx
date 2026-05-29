import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** Temporary placeholder for admin sections not yet built. */
export function AdminPlaceholder({ title, step }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Coming in V2.0 step {step}.</CardDescription>
      </CardHeader>
    </Card>
  )
}
