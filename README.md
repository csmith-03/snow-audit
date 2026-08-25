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

## How it works

1. **Upload** (`/upload`) — user provides an Update Set XML export.
2. **Parse** (`src/lib/parser.ts`) — two-pass XML parse (the outer
   `sys_update_xml` envelope, then the inner record payload) extracts the 4
   supported record types and their script field(s).
3. **Static analysis** (`src/lib/analyzers/staticChecks.ts`) — regex-based
   detectors for the mechanically-detectable half of the checklist. Runs for
   free, no AI call, so a report has real findings today.
4. **AI pass** (`src/lib/analyzers/aiSummary.ts`) — currently a stub.
   Wiring in the Anthropic API here adds plain-English summaries and the
   semantic checks (missing role checks, unvalidated GlideAjax params, etc.)
   static regex can't reliably catch. See the TODO in that file for the
   sketch.
5. **Report** (`/report/[reportId]`) — risk score, per-script findings,
   collapsible by record type. Reports currently live in `sessionStorage`
   only (no DB/persistence yet — that's the next milestone, alongside
   Stripe-gated checkout).

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npx tsc --noEmit
npm run build
```

## Roadmap

- [ ] Wire the real Anthropic API call in `aiSummary.ts`
- [ ] Persist reports (DB) instead of `sessionStorage`
- [ ] Stripe checkout gating report reveal
- [ ] PDF export
- [ ] Live OAuth connection to a ServiceNow instance (skip manual export)
