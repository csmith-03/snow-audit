<a name="readme-top"></a>

<div align="center">

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]

</div>

<br />
<div align="center">

<h3 align="center">snow-audit</h3>

  <p align="center">
    AI-assisted code review for ServiceNow customizations.
    <br />
    <a href="#how-it-works"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/csmith-03/snow-audit/issues/new?labels=bug">Report Bug</a>
    ·
    <a href="https://github.com/csmith-03/snow-audit/issues/new?labels=enhancement">Request Feature</a>
  </p>

  <img width="1880" height="819" alt="image" src="https://github.com/user-attachments/assets/b38a59f0-335f-45a3-860a-6823511854b1" />


</div>

## Table of Contents

- [About The Project](#about-the-project)
- [Built With](#built-with)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Known Limitations](#known-limitations)

## About The Project

Every ServiceNow shop inherits Business Rules, Client Scripts, Script
Includes, and UI Actions nobody documented — written years ago by people who
left. Admins are afraid to touch them, and the only tooling for figuring out
what's safe to change is a consultant doing manual review by eye.

snow-audit takes an Update Set XML export and runs it through a real
checklist — 16 checks across security, code quality, and performance — plus
an AI pass that summarizes what each script actually does. You get a risk
score, a per-script breakdown, and a CSV you can hand to whoever's deciding
what to touch first.

v1 is a deliberately narrow scope: pure script-body review, no live instance
connection, no ACL/config cross-referencing. See [Known
Limitations](#known-limitations) for what that trades away.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Built With

[![Next][Next.js]][Next-url]
[![React][React.js]][React-url]
[![TypeScript][TypeScript]][TypeScript-url]
[![Tailwind][TailwindCSS]][Tailwind-url]
[![Claude][Claude]][Claude-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/csmith-03/snow-audit.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. Set up your environment
   ```sh
   cp .env.example .env.local
   ```
   Add your `ANTHROPIC_API_KEY` to `.env.local`. This is optional — the app
   runs and the static-analysis pass works with no key at all; you only need
   it for the AI summary/semantic-findings pass. See
   [`src/lib/analyzers/aiSummary.ts`](src/lib/analyzers/aiSummary.ts) for
   exactly what degrades without it.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

First, run the development server:

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see
the result.

Try it immediately without a real ServiceNow instance: upload
[`fixtures/sample-update-set.xml`](fixtures/sample-update-set.xml) on the
`/upload` page. It's a small synthetic Update Set (one Script Include, one
Business Rule) with deliberately planted issues — hardcoded credential, query
injection, `deleteMultiple()` with no conditions, a GlideRecord-in-a-loop, and
server-side `async`/`await`/`setTimeout` — so you can see the checklist
actually fire.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## How It Works

1. **Upload** (`/upload`) — user provides an Update Set XML export.
2. **Parse** ([`src/lib/parser.ts`](src/lib/parser.ts)) — two-pass XML parse
   (the outer `sys_update_xml` envelope, then the inner record payload)
   extracts the 4 supported record types and their script field(s). Matches
   on `source_table` first, falling back to the human-readable `<type>` label
   for exports that leave `source_table` blank.
3. **Static analysis**
   ([`src/lib/analyzers/staticChecks.ts`](src/lib/analyzers/staticChecks.ts))
   — regex-based detectors for the mechanically-detectable half of the
   checklist. Runs for free, no AI call, so a report has real findings even
   with no API key.
4. **AI pass**
   ([`src/lib/analyzers/aiSummary.ts`](src/lib/analyzers/aiSummary.ts)) — one
   Claude call per script (bounded to 4 concurrent via
   [`concurrency.ts`](src/lib/concurrency.ts)), structured output constrained
   to the checklist's `checkId`s via a Zod schema. Adds the plain-English
   summary plus the semantic checks static regex can't reliably catch
   (missing role checks, unvalidated GlideAjax params, etc.). Fails soft
   per-script — a missing key, rate limit, or billing issue degrades that
   script to static-only rather than failing the whole report.
5. **Report** (`/report/[reportId]`) — risk score, per-script findings
   collapsible by record type, CSV export. Reports currently live in
   `sessionStorage` only (no DB/persistence yet — see [Roadmap](#roadmap)).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Project Structure

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
  sample-update-set.xml         synthetic Update Set for manual testing (see Usage)
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Roadmap

- [x] Update Set XML parser (Business Rule / Client Script / Script Include / UI Action)
- [x] Static (regex) security/quality/performance checks
- [x] AI summary + semantic findings pass
- [x] Risk scoring
- [x] CSV export
- [ ] PDF export
- [ ] Persist reports (DB) instead of `sessionStorage`
- [ ] Stripe checkout gating report reveal
- [ ] Live OAuth connection to a ServiceNow instance (skip manual export)

See the [open issues](https://github.com/csmith-03/snow-audit/issues) for a
full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions are what make the open source community such an amazing place
to learn, inspire, and create. Any contributions you make are **greatly
appreciated**.

If you have a suggestion that would make this better, please fork the repo
and create a pull request. You can also simply open an issue with the tag
"enhancement". Don't forget to give the project a star!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Before opening a PR, run the full check suite (there's no CI yet, so this is
all of it):

```sh
npm run lint
npx tsc --noEmit
npm run build
```

A few project-specific notes:

- **Adding or editing a check**: everything about a check (id, severity,
  title, description) lives in
  [`src/lib/checklist.ts`](src/lib/checklist.ts). If it's mechanically
  detectable, add a regex detector in `staticChecks.ts` too and set
  `hasStaticDetector: true`. Either way, the AI pass picks up new checklist
  entries automatically — the rubric is generated from `CHECKLIST` at request
  time, nothing to update there.
- **Severity is owned by the checklist, not the AI.** `aiSummary.ts`
  deliberately overwrites whatever severity the model might imply with
  `CHECKLIST_BY_ID[checkId].severity` — keep it that way so severity stays
  consistent regardless of which check fired it.
- **Test parser changes** against `fixtures/sample-update-set.xml` first — if
  you're fixing a bug found against a real export, add a redacted fixture
  reproducing the shape that broke (strip actual script bodies, keep the XML
  structure). Real-world ServiceNow exports vary more than you'd expect (see
  the `source_table` vs `<type>` label fallback in `parser.ts`, which exists
  because of exactly this).
- **Keep the scope cut real.** It's tempting to reach for ACLs, REST Message
  records, or `sys_properties` to make a check smarter — that's a deliberate
  v1 cut (see [About](#about-the-project)), not an oversight. Discuss before
  expanding it.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Known Limitations

- Static detectors are regex-based, not AST-based — see the loop-detection
  heuristic in `staticChecks.ts` for the sharpest edge case (approximates
  balanced parens, doesn't brace-match the loop body).
- Reports aren't persisted — refreshing a tab you didn't generate the report
  in loses it. Top of the roadmap above.
- `computeRiskScore` is a simple capped severity-weighted sum, not tuned
  against real-world instances yet.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->

[contributors-shield]: https://img.shields.io/github/contributors/csmith-03/snow-audit.svg?style=for-the-badge
[contributors-url]: https://github.com/csmith-03/snow-audit/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/csmith-03/snow-audit.svg?style=for-the-badge
[forks-url]: https://github.com/csmith-03/snow-audit/network/members
[stars-shield]: https://img.shields.io/github/stars/csmith-03/snow-audit.svg?style=for-the-badge
[stars-url]: https://github.com/csmith-03/snow-audit/stargazers
[issues-shield]: https://img.shields.io/github/issues/csmith-03/snow-audit.svg?style=for-the-badge
[issues-url]: https://github.com/csmith-03/snow-audit/issues
[Next.js]: https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://react.dev/
[TypeScript]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[TailwindCSS]: https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white
[Tailwind-url]: https://tailwindcss.com/
[Claude]: https://img.shields.io/badge/Claude_API-D97757?style=for-the-badge&logo=anthropic&logoColor=white
[Claude-url]: https://www.anthropic.com/api
