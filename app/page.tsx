"use client"

import type React from "react"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

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
  // Try full URL
  try {
    const u = new URL(input.trim())
    const val = u.searchParams.get(key)
    if (val !== null) return decodeMaybe(val)
  } catch {
    // Not a full URL, proceed
  }

  // Try treating as raw query string
  const raw = input.trim().replace(/^[?#]/, "")
  const qs = new URLSearchParams(raw)
  const val = qs.get(key)
  if (val !== null) return decodeMaybe(val)

  // Try splitting on common delimiters (&,;,, whitespace)
  // Matches key=value or key:value
  const re = new RegExp(`(?:^|[?&;,\\s])${escapeRegExp(key)}\\s*(?:=|:)\\s*("([^"]+)"|'([^']+)'|([^\\s&;,]+))`, "i")
  const m = raw.match(re)
  if (m) {
    return decodeMaybe(m[2] || m[3] || m[4])
  }

  return undefined
}

function searchJsonLike(input: string, key: string): string | number | boolean | null | undefined {
  // Try strict JSON first
  const parsed = tryParseJson(input)
  if (parsed !== undefined) {
    const val = key.includes(".")
      ? getByPath(parsed, key)
      : isObject(parsed)
        ? (parsed as Record<string, unknown>)[key]
        : undefined
    if (val !== undefined && typeof val !== "object") return val as string | number | boolean | null
  }

  // Try JSON-ish regex for "key": "value" | number | true/false | null
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
  // 1) JSON and dot-paths
  const j = searchJsonLike(input, key)
  if (j !== undefined) return j

  // 2) URL / query-like patterns
  const u = searchUrlLike(input, key)
  if (u !== undefined) return u

  // 3) Generic key:value or key=value anywhere
  const generic = new RegExp(`(?:^|[\\s,;|])${escapeRegExp(key)}\\s*(?:=|:)\\s*("([^"]+)"|'([^']+)'|([^\\s,;|]+))`, "i")
  const m = input.match(generic)
  if (m) return m[2] || m[3] || m[4]

  return undefined
}

export default function Page() {
  const [raw, setRaw] = useState("")
  const [propKey, setPropKey] = useState("eid")
  const [result, setResult] = useState<string | number | boolean | null | undefined>(undefined)
  const [message, setMessage] = useState<string>("")
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const keyInputRef = useRef<HTMLInputElement | null>(null)

  // Automatically compute result whenever raw or propKey changes
  useEffect(() => {
    setMessage("")
    if (!raw.trim()) {
      setResult(undefined)
      return
    }
    try {
      const value = extractValue(raw, propKey.trim())
      setResult(value)
      if (value === undefined) {
        setMessage("No match found.")
      } else {
        setMessage("")
      }
    } catch (e) {
      console.log("[v0] Error during search:", (e as Error).message)
      setMessage("An error occurred while searching.")
      setResult(undefined)
    }
  }, [raw, propKey])

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
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-pretty text-2xl font-semibold">Property Value Finder</h1>
        <p className="mt-1 text-muted-foreground">
          Results are computed automatically as you type.
        </p>
      </header>

    <section className="mb-6">
        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        {display !== null && display !== "" && (
          <div className={cn("mt-3 rounded-md border bg-card p-4")}>
            <p className="text-xl font-bold">{display}</p>
          </div>
        )}
      </section>

      <div className="space-y-6">
        <section className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto]">
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
        </section>
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="long-input" className="text-sm font-medium">
              Enter you data
            </Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onPaste} aria-label="Paste from clipboard">
                Paste
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={onClear} aria-label="Clear input">
                Clear
              </Button>
            </div>
          </div>
          <Textarea
            id="long-input"
            ref={textAreaRef}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste your long string here..."
            className="min-h-48"
            aria-describedby="long-input-hint"
          />
          <p id="long-input-hint" className="text-xs text-muted-foreground">
            Paste your data and the result will appear automatically.
          </p>
        </section>
      </div>
    </main>
  )
}
