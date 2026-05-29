"use client"

import { useState } from "react"
import {
  useForm,
  useFieldArray,
  FormProvider,
  useFormContext,
} from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { dealerWizardSchema, STEP_FIELDS } from "@/lib/validation/dealer"
import { humanizeFlag } from "@/lib/eligibility"
import { createDealer } from "@/app/(app)/dealers/new/actions"
import { cn } from "@/lib/utils"
import { SortableList } from "./sortable-list"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const STEPS = [
  { title: "Basics", description: "Dealer details and package." },
  { title: "PMAs", description: "Priority market areas, in order." },
  { title: "Models", description: "Priority models, in order." },
  { title: "Eligibility", description: "Which programs this dealer runs." },
  { title: "Known URLs", description: "Seed any live pages (optional)." },
]

// Small helper so step fields show their error message under the input.
function FieldError({ name }) {
  const {
    formState: { errors },
  } = useFormContext()
  const msg = name.split(".").reduce((o, k) => o?.[k], errors)?.message
  return msg ? <p className="text-tiny text-destructive">{msg}</p> : null
}

// Progress dots: 6px circles, accent for done/current, border for upcoming.
function Stepper({ step }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {STEPS.map((s, i) => (
        <span
          key={s.title}
          className={cn(
            "size-1.5 rounded-full transition-colors",
            i <= step ? "bg-primary" : "bg-border"
          )}
        />
      ))}
    </div>
  )
}

// Last-step recap of what the wizard will create.
function WizardSummary({ values, urlCount }) {
  const elig = Object.values(values.eligibility ?? {}).filter(Boolean).length
  const rows = [
    ["Dealer", values.name || "—"],
    ["OEM / Package", `${values.oem ?? "—"} · ${values.package_tier ?? "—"}`],
    ["PMAs", String((values.pmas ?? []).length)],
    ["Priority models", String((values.models ?? []).length)],
    ["Eligibility flags", String(elig)],
    ["Known URLs", String(urlCount)],
  ]
  return (
    <div className="rounded-md border bg-muted/40 p-4">
      <p className="mb-2 text-tiny font-medium uppercase tracking-wide text-muted-foreground">
        On create
      </p>
      <dl className="grid gap-1 text-small">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — basics
// ---------------------------------------------------------------------------
function BasicsStep({ accountManagers, oems }) {
  const { register, setValue, watch } = useFormContext()
  const tier = watch("package_tier")
  const amId = watch("am_id")
  const oem = watch("oem")

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Dealer name</Label>
        <Input id="name" placeholder="Kia of East Hartford" {...register("name")} />
        <FieldError name="name" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>OEM</Label>
          <Select
            value={oem ?? ""}
            onValueChange={(v) => {
              setValue("oem", v)
              setValue("models", []) // model lineup is OEM-specific
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select OEM" />
            </SelectTrigger>
            <SelectContent>
              {oems.map((o) => (
                <SelectItem key={o.name} value={o.name}>
                  {o.label ?? o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Package tier</Label>
          <Select value={tier ?? ""} onValueChange={(v) => setValue("package_tier", v, { shouldValidate: true })}>
            <SelectTrigger>
              <SelectValue placeholder="Select tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Essential">Essential</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
              <SelectItem value="Elite">Elite</SelectItem>
            </SelectContent>
          </Select>
          <FieldError name="package_tier" />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="website">Website</Label>
        <Input id="website" placeholder="https://www.kiaofeasthartford.com/" {...register("website")} />
        <FieldError name="website" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" placeholder="99 Ash St. East Hartford, CT 06108" {...register("address")} />
      </div>

      <div className="grid gap-2">
        <Label>Account manager</Label>
        <Select
          value={amId ?? "none"}
          onValueChange={(v) => setValue("am_id", v === "none" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unassigned</SelectItem>
            {accountManagers.map((am) => (
              <SelectItem key={am.id} value={am.id}>
                {am.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {accountManagers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No account managers yet — add them in Supabase, then they&apos;ll
            appear here.
          </p>
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — PMAs
// ---------------------------------------------------------------------------
function PmasStep() {
  const { control } = useFormContext()
  const { fields, append, remove, move } = useFieldArray({ control, name: "pmas" })
  const [city, setCity] = useState("")

  function add() {
    const value = city.trim()
    if (!value) return
    if (fields.length >= 9) return toast.error("Up to 9 PMAs.")
    if (fields.some((f) => f.city.toLowerCase() === value.toLowerCase())) {
      return toast.error(`${value} is already added.`)
    }
    append({ city: value })
    setCity("")
  }

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        <Input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Add a city (e.g. East Hartford)"
        />
        <Button type="button" onClick={add} disabled={fields.length >= 9}>
          Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag to reorder by priority — top = highest. {fields.length}/9 added.
      </p>
      <SortableList
        items={fields.map((f) => ({ id: f.id, label: f.city }))}
        onReorder={move}
        onRemove={remove}
      />
      <FieldError name="pmas" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — priority models
// ---------------------------------------------------------------------------
function ModelsStep({ modelsByOem }) {
  const { control, watch } = useFormContext()
  const { fields, append, remove, move } = useFieldArray({ control, name: "models" })
  const oem = watch("oem")
  const oemModels = modelsByOem?.[oem] ?? []

  const added = new Set(fields.map((f) => f.model))

  function addModel(model) {
    if (fields.length >= 9) return toast.error("Up to 9 models.")
    if (added.has(model)) return
    append({ model })
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {oemModels.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            No models defined for this OEM — add them in Admin → OEMs.
          </span>
        ) : null}
        {oemModels.map((m) => (
          <Button
            key={m}
            type="button"
            variant="outline"
            size="sm"
            disabled={added.has(m) || fields.length >= 9}
            onClick={() => addModel(m)}
          >
            {m}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Click to add, drag to reorder by priority. {fields.length}/9 added.
      </p>
      <SortableList
        items={fields.map((f) => ({ id: f.id, label: f.model }))}
        onReorder={move}
        onRemove={remove}
      />
      <FieldError name="models" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4 — eligibility
// ---------------------------------------------------------------------------
function EligibilityStep({ flags }) {
  const { watch, setValue } = useFormContext()
  const eligibility = watch("eligibility")

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {flags.map((flag) => (
        <label
          key={flag}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-small hover:bg-accent"
        >
          <Checkbox
            checked={!!eligibility?.[flag]}
            onCheckedChange={(c) => setValue(`eligibility.${flag}`, !!c)}
          />
          {humanizeFlag(flag)}
        </label>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 5 — known URLs
// ---------------------------------------------------------------------------
function UrlsStep({ urlsText, setUrlsText }) {
  const count = urlsText
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean).length

  return (
    <div className="grid gap-2">
      <Label htmlFor="urls">Known live URLs (optional)</Label>
      <textarea
        id="urls"
        value={urlsText}
        onChange={(e) => setUrlsText(e.target.value)}
        rows={10}
        placeholder={"One URL per line, e.g.\nhttps://www.kiaofeasthartford.com/\nhttps://www.kiaofeasthartford.com/service/"}
        className="min-h-40 w-full rounded-md border bg-transparent px-3 py-2 font-mono text-small outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
      />
      <p className="text-xs text-muted-foreground">
        {count} URL{count === 1 ? "" : "s"}. These seed page accounting in the
        next step — pages with a matching URL start as LIVE.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------
export function DealerWizard({ accountManagers, flags, oems, modelsByOem }) {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [urlsText, setUrlsText] = useState("")

  const methods = useForm({
    resolver: zodResolver(dealerWizardSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      oem: oems?.[0]?.name ?? "KIA",
      website: "",
      address: "",
      package_tier: undefined,
      am_id: null,
      pmas: [],
      models: [],
      eligibility: Object.fromEntries(flags.map((f) => [f, false])),
      urls: [],
    },
  })

  const isLast = step === STEPS.length - 1

  async function next() {
    const ok = await methods.trigger(STEP_FIELDS[step])
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  async function onSubmit(values) {
    setSubmitting(true)
    const urls = urlsText
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean)

    const payload = {
      ...values,
      website: values.website || "",
      urls,
    }

    const res = await createDealer(payload)
    // On success the server action redirects (no return). Only an error comes back.
    if (res?.error) {
      toast.error(res.error)
      setSubmitting(false)
    }
  }

  return (
    <FormProvider {...methods}>
      <Card className="max-w-2xl">
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between">
            <Stepper step={step} />
            <span className="text-tiny text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <CardTitle className="text-h1">{STEPS[step].title}</CardTitle>
          <CardDescription>{STEPS[step].description}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="grid gap-6">
            {step === 0 && <BasicsStep accountManagers={accountManagers} oems={oems} />}
            {step === 1 && <PmasStep />}
            {step === 2 && <ModelsStep modelsByOem={modelsByOem} />}
            {step === 3 && <EligibilityStep flags={flags} />}
            {step === 4 && (
              <UrlsStep urlsText={urlsText} setUrlsText={setUrlsText} />
            )}

            {isLast ? (
              <WizardSummary
                values={methods.watch()}
                urlCount={urlsText.split("\n").map((u) => u.trim()).filter(Boolean).length}
              />
            ) : null}

            <div className="flex items-center justify-between border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
                disabled={step === 0 || submitting}
              >
                Back
              </Button>
              {isLast ? (
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating…" : "Create dealer"}
                </Button>
              ) : (
                <Button type="button" onClick={next}>
                  Continue
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </FormProvider>
  )
}
