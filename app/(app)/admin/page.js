import { redirect } from "next/navigation"

// Admin index → first section.
export default function AdminIndexPage() {
  redirect("/admin/account-managers")
}
