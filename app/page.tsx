"use client"

import type React from "react"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { themes, getTheme, DEFAULT_THEME, type ThemeConfig } from "@/lib/themes"

const darkThemes: ThemeConfig[] = themes.filter((t) =>
  ["midnight", "obsidian", "ember", "aurora", "velvet", "cobalt"].includes(t.name)
)
const lightThemes: ThemeConfig[] = themes.filter((t) =>
  ["ivory", "sand", "arctic", "rose"].includes(t.name)
)

type JsonValue = string | number | boolean | null | JsonObject | JsonArray
type JsonObject = { [key: string]: JsonValue }
type JsonArray = JsonValue[]

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function getByPath(obj: unknown, path: string): unknown {
  if (!isObject(obj)) return undefined
  const parts = path.split(".").filter(Boolean)
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null) return undefined
    if (Array.isArray(cur)) {
      const idx = Number(p)
      cur = Number.isInteger(idx) ? cur[idx] : undefined
    } else if (isObject(cur)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return cur
}

function tryParseJson(input: string): unknown | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function decodeMaybe(s: string) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function searchUrlLike(input: string, key: string): string | undefined {
  try {
    const u = new URL(input.trim())
    const val = u.searchParams.get(key)
    if (val !== null) return decodeMaybe(val)
  } catch {
    // Not a full URL
  }

  const raw = input.trim().replace(/^[?#]/, "")
  const qs = new URLSearchParams(raw)
  const val = qs.get(key)
  if (val !== null) return decodeMaybe(val)

  const re = new RegExp(`(?:^|[?&;,\\s])${escapeRegExp(key)}\\s*(?:=|:)\\s*("([^"]+)"|'([^']+)'|([^\\s&;,]+))`, "i")
  const m = raw.match(re)
  if (m) {
    return decodeMaybe(m[2] || m[3] || m[4])
  }

  return undefined
}

function searchJsonLike(input: string, key: string): string | number | boolean | null | undefined {
  const parsed = tryParseJson(input)
  if (parsed !== undefined) {
    const val = key.includes(".")
      ? getByPath(parsed, key)
      : isObject(parsed)
        ? (parsed as Record<string, unknown>)[key]
        : undefined
    if (val !== undefined && typeof val !== "object") return val as string | number | boolean | null
  }

  const keyRe = escapeRegExp(key)
  const jsonishRe = new RegExp(`"${keyRe}"\\s*:\\s*(?:"([^"]+)"|'([^']+)'|([\\-\\d.]+)|(true|false)|null)`, "i")
  const m = input.match(jsonishRe)
  if (!m) return undefined
  if (m[1] != null) return m[1]
  if (m[2] != null) return m[2]
  if (m[3] != null) {
    const n = Number(m[3])
    return Number.isNaN(n) ? (m[3] as unknown as string) : n
  }
  if (m[4] != null) return m[4].toLowerCase() === "true"
  return null
}

function extractValue(input: string, key: string): string | number | boolean | null | undefined {
  if (!key.trim()) return undefined
  const j = searchJsonLike(input, key)
  if (j !== undefined) return j
  const u = searchUrlLike(input, key)
  if (u !== undefined) return u
  const generic = new RegExp(`(?:^|[\\s,;|])${escapeRegExp(key)}\\s*(?:=|:)\\s*("([^"]+)"|'([^']+)'|([^\\s,;|]+))`, "i")
  const m = input.match(generic)
  if (m) return m[2] || m[3] || m[4]
  return undefined
}

function extractAllValues(input: string, key: string): string[] {
  if (!key.trim() || !input.trim()) return []
  const keyRe = escapeRegExp(key)
  const re = new RegExp(`"${keyRe}"\\s*:\\s*(?:"([^"]*)"|([-\\d.]+)|(true|false)|null)`, "gi")
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(input)) !== null) {
    const val = m[1] ?? m[2] ?? m[3] ?? "null"
    if (val && !results.includes(val)) {
      results.push(val)
    }
  }
  return results
}

const THEME_STORAGE_KEY = "kf-theme"

export default function Page() {
  const [raw, setRaw] = useState("")
  const [propKey, setPropKey] = useState("eid")
  const [result, setResult] = useState<string | number | boolean | null | undefined>(undefined)
  const [allMatches, setAllMatches] = useState<string[]>([])
  const [message, setMessage] = useState<string>("")
  const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME)
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const keyInputRef = useRef<HTMLInputElement | null>(null)

  // Load saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved && themes.some((t) => t.name === saved)) {
      setCurrentTheme(saved)
    }
  }, [])

  // Apply theme CSS variables + gradient to <html>
  useEffect(() => {
    const theme = getTheme(currentTheme)
    const root = document.documentElement
    for (const [prop, value] of Object.entries(theme.vars)) {
      root.style.setProperty(prop, value)
    }
    document.body.style.backgroundImage = theme.gradient ?? "none"
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme)
  }, [currentTheme])

  useEffect(() => {
    setMessage("")
    if (!raw.trim()) {
      setResult(undefined)
      setAllMatches([])
      return
    }
    try {
      const matches = extractAllValues(raw, propKey.trim())
      setAllMatches(matches)

      const value = extractValue(raw, propKey.trim())
      setResult(value)
      if (matches.length === 0 && value === undefined) {
        setMessage("No match found.")
      } else {
        setMessage("")
      }
    } catch (e) {
      console.log("[v0] Error during search:", (e as Error).message)
      setMessage("An error occurred while searching.")
      setResult(undefined)
      setAllMatches([])
    }
  }, [raw, propKey])

  const copyToClipboard = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success("Copied to clipboard", { description: value })
    } catch {
      toast.error("Failed to copy to clipboard")
    }
  }, [])

  const onPaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setRaw(text)
        setMessage("Pasted from clipboard.")
      } else {
        setMessage("Clipboard is empty.")
      }
      textAreaRef.current?.focus()
    } catch (e) {
      console.log("[v0] Clipboard read failed:", (e as Error).message)
      setMessage("Unable to read from clipboard. Check permissions.")
    }
  }, [])

  const onClear = useCallback(() => {
    setRaw("")
    setResult(undefined)
    setAllMatches([])
    setMessage("Cleared.")
    textAreaRef.current?.focus()
  }, [])

  const display = useMemo(() => {
    if (result === undefined) return null
    if (typeof result === "string") return result
    if (typeof result === "number" || typeof result === "boolean") return String(result)
    if (result === null) return "null"
    return ""
  }, [result])

  return (
    <main className="flex h-dvh overflow-hidden">
      {/* ── Left panel: Data input ── */}
      <section className="flex w-1/2 flex-col border-r border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Label htmlFor="long-input" className="text-sm font-medium">
            Enter your data
          </Label>
        </div>
        <div className="flex-1 overflow-hidden p-4">
          <Textarea
            id="long-input"
            ref={textAreaRef}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste your long string here..."
            className="h-full resize-none font-mono text-xs"
            aria-describedby="long-input-hint"
          />
        </div>
      </section>

      {/* ── Right panel: Controls + results ── */}
      <section className="flex w-1/2 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">Property Value Finder</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Results are computed automatically as you type.
            </p>
          </div>
          <Select value={currentTheme} onValueChange={setCurrentTheme}>
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Dark</SelectLabel>
                {darkThemes.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Light</SelectLabel>
                {lightThemes.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </header>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {message && <p className="text-sm text-muted-foreground">{message}</p>}

          {allMatches.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Found {allMatches.length} {propKey}{allMatches.length > 1 ? "s" : ""} — click to copy
              </p>
              <div className="flex flex-wrap gap-2">
                {allMatches.map((val, idx) => (
                  <button
                    key={`${val}-${idx}`}
                    type="button"
                    onClick={() => copyToClipboard(val)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm font-mono transition-colors cursor-pointer",
                      "hover:bg-primary hover:text-primary-foreground",
                      "bg-card"
                    )}
                    aria-label={`Copy ${propKey}: ${val}`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          )}

          {allMatches.length === 0 && display !== null && display !== "" && (
            <div className="rounded-md border bg-card p-4">
              <p className="text-xl font-bold">{display}</p>
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="border-t border-border px-6 py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prop-key" className="text-sm font-medium">
              Property Key
            </Label>
            <Input
              id="prop-key"
              ref={keyInputRef}
              value={propKey}
              onChange={(e) => setPropKey(e.target.value)}
              placeholder="e.g. eid or user.id"
              aria-label="Property key to search"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClear}
              aria-label="Clear input"
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="default"
              className="flex-1"
              onClick={onPaste}
              aria-label="Clear and paste from clipboard"
            >
              Clear &amp; Paste
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
