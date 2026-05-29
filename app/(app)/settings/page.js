import { jiraConfig, isJiraConfigured } from "@/lib/jira"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function SettingsPage() {
  const cfg = jiraConfig()
  const configured = isJiraConfigured()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">App integrations.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="text-base">Jira</CardTitle>
            <CardDescription>
              Push pages + subtasks as issues and sync their status back.
            </CardDescription>
          </div>
          <Badge variant={configured ? "default" : "outline"}>
            {configured ? "Connected" : "Not configured"}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          {configured ? (
            <>
              <div>
                <span className="text-muted-foreground">Site: </span>
                {cfg.baseUrl}
              </div>
              <div>
                <span className="text-muted-foreground">Project: </span>
                {cfg.projectKey}
              </div>
              <div>
                <span className="text-muted-foreground">Issue types: </span>
                {cfg.pageIssueType} / {cfg.subtaskIssueType}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              Set <code>JIRA_BASE_URL</code>, <code>JIRA_EMAIL</code>,{" "}
              <code>JIRA_API_TOKEN</code>, and <code>JIRA_PROJECT_KEY</code> in
              your environment to enable Push to Jira and status sync. Until then,
              use the CSV export.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
