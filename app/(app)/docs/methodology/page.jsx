import { readFileSync } from "node:fs"
import { join } from "node:path"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSlug from "rehype-slug"
import rehypeAutolinkHeadings from "rehype-autolink-headings"

import { DocsToc } from "@/components/docs-toc"
import { cn } from "@/lib/utils"

export const metadata = { title: "Methodology · SEO Page Manager" }

// Matches rehype-slug's output for these headings.
function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

// Markdown element → app design-token styling (shadcn CSS-variable utilities).
const components = {
  h1: ({ children, ...p }) => (
    <h1 {...p} className="mb-6 scroll-mt-20 text-3xl font-medium tracking-tight">
      {children}
    </h1>
  ),
  h2: ({ children, ...p }) => (
    <h2 {...p} className="mt-10 mb-3 scroll-mt-20 border-t pt-6 text-xl font-medium tracking-tight">
      {children}
    </h2>
  ),
  h3: ({ children, ...p }) => (
    <h3 {...p} className="mt-6 mb-2 scroll-mt-20 text-base font-medium">
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="mb-4 text-sm leading-7 text-foreground/90">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-5 text-sm leading-7">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm leading-7">{children}</ol>,
  li: ({ children }) => <li className="text-foreground/90">{children}</li>,
  strong: ({ children }) => <strong className="font-medium text-foreground">{children}</strong>,
  a: ({ href, children, ...p }) =>
    href?.startsWith("#") ? (
      <a href={href} {...p} className="text-inherit no-underline">
        {children}
      </a>
    ) : (
      <a
        href={href}
        {...p}
        className="text-primary underline underline-offset-2"
        target={href?.startsWith("http") ? "_blank" : undefined}
        rel="noreferrer"
      >
        {children}
      </a>
    ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-md border">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-t px-3 py-2 align-top text-foreground/90">{children}</td>,
  code: ({ children, className }) => {
    const text = String(children)
    const block = text.includes("\n") || /language-/.test(className || "")
    return block ? (
      <code className={cn("font-mono", className)}>{children}</code>
    ) : (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-md border bg-muted/50 p-4 text-xs leading-relaxed">
      {children}
    </pre>
  ),
}

export default function MethodologyPage() {
  const md = readFileSync(join(process.cwd(), "content/methodology.md"), "utf8")

  // Build the TOC from H2 headings.
  const toc = md
    .split("\n")
    .filter((l) => /^## /.test(l))
    .map((l) => {
      const title = l.replace(/^##\s+/, "").trim()
      return { title, slug: slugify(title) }
    })

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <aside className="lg:sticky lg:top-6 lg:h-fit lg:w-60 lg:shrink-0">
        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          On this page
        </p>
        <DocsToc items={toc} />
      </aside>

      <article className="min-w-0 max-w-[720px] flex-1">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]]}
          components={components}
        >
          {md}
        </ReactMarkdown>
      </article>
    </div>
  )
}
