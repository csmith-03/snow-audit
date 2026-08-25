# snow-audit

AI-assisted code review for ServiceNow customizations. Upload an Update Set
XML export and get a plain-English summary plus a security/quality review of
every scripted record in it.

## Scope (v1)

Pure dev/code audit — no live instance connection, no ACL/config
cross-referencing. Four record types only:

- Business Rule (`sys_script`)
- Client Script (`sys_script_client`)
- Script Include (`sys_script_include`)
- UI Action (`sys_ui_action`)

The checklist (`src/lib/checklist.ts`) covers 16 checks across security, code
quality, and performance — adapted from an internal ServiceNow review
checklist, trimmed to what's answerable from script source alone. Anything
needing another table (ACL records, REST Message auth, `sys_properties`) is
deliberately out of scope for now.

## Quick start

```bash
git clone <this repo>
cd snow-audit
npm install
cp .env.example .env.local   # then add your Anthropic API key
npm run dev                  # http://localhost:3000
```

The app runs and the parser/static-analysis pass works with **no API key at
all** — `/upload` degrades gracefully to static-only findings and says so on
each script's summary. You only need `ANTHROPIC_API_KEY` set to exercise the
AI summary/semantic-findings pass.

Try it immediately without a real ServiceNow instance: upload
[`fixtures/sample-update-set.xml`](fixtures/sample-update-set.xml) on the
`/upload` page. It's a small synthetic Update Set (one Script Include, one
Business Rule) with deliberately planted issues — hardcoded credential, query
injection, `deleteMultiple()` with no conditions, a GlideRecord-in-a-loop, and
server-side `async`/`await`/`setTimeout` — so you can see the checklist
actually fire.

## Environment variables

| Variable            | Required?          | Purpose                                                                 |
| -------------------- | ------------------- | ------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY`  | No (recommended)    | Enables the AI summary + semantic findings pass. See `src/lib/analyzers/aiSummary.ts` for exactly how it's used and what happens when it's absent. |

## Project structure

```
src/
  app/
    page.tsx                    landing page
    upload/page.tsx             upload form -> POST /api/analyze -> sessionStorage -> redirect
    report/[reportId]/page.tsx  report view (reads sessionStorage — no DB yet)
    api/analyze/route.ts        parse -> static checks -> AI pass -> risk score
  lib/
    types.ts                    core data model (Script, Finding, Report, ...)
    checklist.ts                the 16 checks — start here to add/edit a check
    recordTypes.ts               ServiceNow table <-> our 4 supported record types
    parser.ts                   Update Set XML -> Script[] (two-pass XML parse)
    riskScore.ts                findings -> 0-100 instance risk score
    csvExport.ts                findings -> downloadable CSV
    concurrency.ts              bounded-concurrency map, used to throttle AI calls
    analyzers/
      staticChecks.ts           regex-based detectors, free, no AI call
      aiSummary.ts              real Anthropic API call — structured output via Zod
  components/                   small shared UI (severity/risk badges)
fixtures/
  sample-update-set.xml         synthetic Update Set for manual testing (see Quick start)
```

## How it works

1. **Upload** (`/upload`) — user provides an Update Set XML export.
2. **Parse** (`src/lib/parser.ts`) — two-pass XML parse (the outer
   `sys_update_xml` envelope, then the inner record payload) extracts the 4
   supported record types and their script field(s). Matches on
   `source_table` first, falling back to the human-readable `<type>` label
   for exports that leave `source_table` blank.
3. **Static analysis** (`src/lib/analyzers/staticChecks.ts`) — regex-based
   detectors for the mechanically-detectable half of the checklist. Runs for
   free, no AI call, so a report has real findings even with no API key.
4. **AI pass** (`src/lib/analyzers/aiSummary.ts`) — one Claude call per
   script (bounded to 4 concurrent via `concurrency.ts`), structured output
   constrained to the checklist's `checkId`s via a Zod schema. Adds the
   plain-English summary plus the semantic checks static regex can't reliably
   catch (missing role checks, unvalidated GlideAjax params, etc.). Fails soft
   per-script — a missing key, rate limit, or billing issue degrades that
   script to static-only rather than failing the whole report.
5. **Report** (`/report/[reportId]`) — risk score, per-script findings
   collapsible by record type, CSV export. Reports currently live in
   `sessionStorage` only (no DB/persistence yet — see Roadmap).

## Development

```bash
npm run dev        # http://localhost:3000
npm run lint
npx tsc --noEmit
npm run build
```

All four should pass clean before opening a PR — there's no CI yet, so this
is the whole check suite.

## Contributing

- **Adding or editing a check**: everything about a check (id, severity,
  title, description) lives in `src/lib/checklist.ts`. If it's mechanically
  detectable, add a regex detector in `staticChecks.ts` too and set
  `hasStaticDetector: true` — see the existing detectors for the pattern
  (each pushes a `Finding` via the shared `makeFinding` helper, and reuses
  `lineNumberAt`/`snippetAround` for location). Either way, the AI pass picks
  up new checklist entries automatically — the rubric is generated from
  `CHECKLIST` at request time, nothing to update there.
- **Severity is owned by the checklist, not the AI.** `aiSummary.ts`
  deliberately overwrites whatever severity the model might imply with
  `CHECKLIST_BY_ID[checkId].severity` — keep it that way so severity stays
  consistent regardless of which check fired it.
- **Test parser changes** against `fixtures/sample-update-set.xml` first —
  it's small enough to read end-to-end and has known-good expected output
  (see the planted issues listed in Quick start). If you're fixing a parser
  bug found against a real export, add a redacted fixture reproducing the
  shape that broke (strip actual script bodies, keep the XML structure) —
  real-world ServiceNow exports vary more than you'd expect (see the
  `source_table` vs `<type>` label fallback in `parser.ts`, which exists
  because of exactly this).
- **Keep the scope cut real.** It's tempting to reach for ACLs, REST Message
  records, or `sys_properties` to make a check smarter — that's a deliberate
  v1 cut (see Scope above), not an oversight. Discuss before expanding it.

## Known limitations

- Static detectors are regex-based, not AST-based — see the loop-detection
  heuristic in `staticChecks.ts` for the sharpest edge case (approximates
  balanced parens, doesn't brace-match the loop body).
- Reports aren't persisted — refreshing a tab you didn't generate the report
  in loses it. This is the top of the roadmap below.
- `computeRiskScore` is a simple capped severity-weighted sum, not tuned
  against real-world instances yet.

## Roadmap

- [ ] Persist reports (DB) instead of `sessionStorage`
- [ ] Stripe checkout gating report reveal
- [ ] PDF export (CSV export shipped)
- [ ] Live OAuth connection to a ServiceNow instance (skip manual export)
