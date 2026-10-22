import { useEffect, useMemo, useRef, useState } from "react"
import { Search } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusText } from "@/components/wrap"
import type { RecordSet } from "@/lib/ens/recordset"
import { featuredAddressDefs, withLabel } from "@/lib/ens/profile"
import { SECTIONS, TEXT_SPECS, type RecordDef, type Section, abiDef, contenthashDef, decodeValue, defFromId, encodeValue, listCoins, searchDefs, textDef, validateValue } from "@/lib/records"

type DraftsApi = {
  /** staged values by record id, in stored form */
  records: Record<string, string>
  setRecord: (id: string, value: string | null) => void
}

const EDIT_SECTIONS = SECTIONS.filter((s) => s.id !== "owned")
const WIDE_TEXT = new Set(["description", "avatar", "header", "url", "notice", "keywords"])
const isWide = (def: RecordDef) => def.kind === "contenthash" || def.kind === "abi" || (def.kind === "text" && WIDE_TEXT.has(def.arg as string))
const norm = (v: string | undefined) => (!v || v === "0x" ? "" : v)

/** The records a section shows before anyone adds more. */
function baseDefs(section: Section, recordsChainId: number): RecordDef[] {
  switch (section) {
    case "addresses":
      return featuredAddressDefs(recordsChainId)
    case "website":
      return [contenthashDef]
    case "advanced":
      return [abiDef(1)]
    default:
      return TEXT_SPECS.filter((s) => s.section === section && s.featured).map((s) => textDef(s.key))
  }
}

/**
 * Edit every kind of record a name carries: text, addresses on any coin, content hash, abi.
 * Values are decoded for people and encoded back to bytes when staged. Nothing is written
 * until the owner publishes.
 */
function RecordEditor({
  recordsChainId,
  set,
  drafts,
  enabled,
  disabledReason,
  onDone,
}: {
  recordsChainId: number
  set: RecordSet | undefined
  drafts: DraftsApi
  enabled: boolean
  disabledReason?: string
  onDone?: () => void
}) {
  const current = useMemo(() => set?.values ?? {}, [set])
  const [section, setSection] = useState<Section>("profile")
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [added, setAdded] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [focusId, setFocusId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const inputs = useRef(new Map<string, HTMLInputElement>())

  // seed the form from stored values, overlaid with what is already staged
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const [id, raw] of Object.entries({ ...current, ...drafts.records })) {
      const def = defFromId(id)
      if (!def || def.kind === "data") continue
      next[id] = decodeValue(def, raw)
    }
    setValues(next)
  }, [current, drafts.records])

  useEffect(() => {
    if (!focusId) return
    inputs.current.get(focusId)?.focus()
    setFocusId(null)
  }, [focusId, section])

  const sectionOf = (id: string) => defFromId(id)?.section
  const stagedBySection = useMemo(() => {
    const m = new Map<Section, number>()
    for (const id of Object.keys(drafts.records)) {
      const s = sectionOf(id)
      if (s) m.set(s, (m.get(s) ?? 0) + 1)
    }
    return m
  }, [drafts.records])

  // defs shown in the open section: the base set, then anything with a value, staged, or added by hand
  const defs = useMemo(() => {
    const out: RecordDef[] = baseDefs(section, recordsChainId)
    const seen = new Set(out.map((d) => d.id))
    const extra = [...Object.keys(current), ...Object.keys(drafts.records), ...added]
      .map(defFromId)
      .filter((d): d is RecordDef => !!d && d.kind !== "data" && d.section === section && !seen.has(d.id))
      .map((d) => withLabel(d, recordsChainId))
    for (const d of extra) if (!seen.has(d.id)) { seen.add(d.id); out.push(d) }
    return out
  }, [section, recordsChainId, current, drafts.records, added])

  const more = useMemo(() => {
    const shown = new Set(defs.map((d) => d.id))
    return TEXT_SPECS.filter((s) => s.section === section).map((s) => textDef(s.key)).filter((d) => !shown.has(d.id))
  }, [defs, section])

  const results = useMemo(() => (query.trim() ? searchDefs(query, 8).map((d) => withLabel(d, recordsChainId)) : []), [query, recordsChainId])

  function add(def: RecordDef) {
    setAdded((a) => (a.includes(def.id) ? a : [...a, def.id]))
    setSection(def.section)
    setQuery("")
    setFocusId(def.id)
  }

  function edit(def: RecordDef, text: string) {
    setValues((v) => ({ ...v, [def.id]: text }))
    const err = validateValue(def, text)
    setErrors((e) => {
      const next = { ...e }
      if (err) next[def.id] = err
      else delete next[def.id]
      return next
    })
  }

  function stage() {
    setSaveError(null)
    const ids = new Set([...Object.keys(values), ...Object.keys(current), ...Object.keys(drafts.records)])
    const changes: [string, string | null][] = []
    for (const id of ids) {
      const def = defFromId(id)
      if (!def || def.kind === "data" || def.kind === "name") continue
      const text = (values[id] ?? "").trim()
      const err = validateValue(def, text)
      if (err) return fail(def, err)
      let encoded: string
      try {
        encoded = encodeValue(def, text)
      } catch (e) {
        return fail(def, (e as Error).message)
      }
      const was = norm(current[id])
      const same = def.kind === "text" ? encoded === was : norm(encoded).toLowerCase() === was.toLowerCase()
      changes.push([id, same ? null : encoded])
    }
    for (const [id, v] of changes) drafts.setRecord(id, v)
    onDone?.()

    function fail(def: RecordDef, message: string) {
      setErrors((e) => ({ ...e, [def.id]: message }))
      setSection(def.section)
      setFocusId(def.id)
      setSaveError(`${def.label}: ${message}`)
    }
  }

  const staged = Object.keys(drafts.records).length
  const coinCount = listCoins().length

  return (
    <div>
      {/* section strip + search */}
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {EDIT_SECTIONS.map((s) => {
            const n = stagedBySection.get(s.id) ?? 0
            const active = s.id === section
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={cn("t-label -mb-px border-b pb-1 transition-colors", active ? "border-blue text-blue" : "border-transparent text-ink-dim hover:text-ink")}
              >
                {s.label}
                {n > 0 ? <span className="ml-1.5 text-blue">{n}</span> : null}
              </button>
            )
          })}
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ink-dim" />
          <Input
            value={query}
            placeholder="add a record · key or coin"
            className="h-9 pl-9"
            disabled={!enabled}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) add(results[0])
              if (e.key === "Escape") setQuery("")
            }}
          />
          {results.length > 0 ? (
            <ul className="absolute right-0 left-0 z-20 mt-1 max-h-72 overflow-auto border border-line bg-paper shadow-sm">
              {results.map((d) => (
                <li key={d.id}>
                  <button type="button" className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-[12px] hover:bg-wash" onClick={() => add(d)}>
                    <span className="font-semibold text-ink">{d.label}</span>
                    <span className="truncate text-ink-dim">{d.kind === "address" ? `${d.longName ?? ""} · coin ${d.arg}` : d.kind === "text" ? `text · ${d.arg}` : d.longName ?? d.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {/* fields */}
      <div className="p-4 sm:p-5">
        <p className="t-caption mb-3 normal-case tracking-normal">
          {EDIT_SECTIONS.find((s) => s.id === section)?.hint}
          {section === "addresses" ? ` · leave a field blank to clear it. search above for any of ${coinCount} coins.` : section === "advanced" ? " · search above to add a custom text key." : " · leave a field blank to clear it."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {defs.map((def) => {
            const id = def.id
            const stagedHere = drafts.records[id] !== undefined
            const err = errors[id]
            return (
              <div key={id} className={isWide(def) ? "sm:col-span-2" : undefined}>
                <Label htmlFor={`r-${id}`} className="mb-1.5 flex-wrap">
                  {def.label}
                  {def.kind === "text" ? (
                    def.arg !== def.label ? <span className="normal-case tracking-normal text-ink-dim/80">· {def.arg}</span> : null
                  ) : def.longName && def.longName.toLowerCase() !== def.label.toLowerCase() ? (
                    <span className="normal-case tracking-normal text-ink-dim/80">· {def.longName}</span>
                  ) : null}
                  {stagedHere ? <span className="text-blue">· staged</span> : null}
                </Label>
                <Input
                  id={`r-${id}`}
                  ref={(el) => {
                    if (el) inputs.current.set(id, el)
                    else inputs.current.delete(id)
                  }}
                  value={values[id] ?? ""}
                  placeholder={def.placeholder}
                  disabled={!enabled}
                  aria-invalid={!!err}
                  className={def.kind === "address" ? "tabular" : undefined}
                  onChange={(e) => edit(def, e.target.value)}
                />
                {err ? (
                  <StatusText tone="err" className="mt-1 block text-[11px]">{err}</StatusText>
                ) : def.hint ? (
                  <span className="t-caption mt-1 block normal-case tracking-normal">{def.hint}</span>
                ) : null}
              </div>
            )
          })}
        </div>
        {more.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-ink-dim">more:</span>
            {more.map((d) => (
              <button key={d.id} type="button" disabled={!enabled} className="border border-line px-2 py-0.5 text-ink-muted hover:border-blue hover:text-blue disabled:opacity-50" onClick={() => add(d)}>
                + {d.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 sm:px-5">
        <Button variant={enabled ? "accent" : "outline"} disabled={!enabled} onClick={stage}>save changes for publishing</Button>
        {onDone ? <Button variant="ghost" onClick={onDone}>cancel</Button> : null}
        {staged > 0 ? <span className="text-[12px] text-ink-muted">{staged} {staged === 1 ? "change" : "changes"} waiting · nothing is written until you publish.</span> : null}
        {!enabled && disabledReason ? <span className="t-caption normal-case tracking-normal">{disabledReason}</span> : null}
        {saveError ? <StatusText tone="err" className="text-[12px]">{saveError}</StatusText> : null}
      </div>
    </div>
  )
}

export { RecordEditor }
