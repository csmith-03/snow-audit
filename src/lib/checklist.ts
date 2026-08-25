import type { Severity } from "./types";

export type CheckCategory = "security" | "quality" | "performance";

export interface Check {
  id: string;
  category: CheckCategory;
  severity: Severity;
  title: string;
  description: string;
  /** Whether a cheap regex/AST heuristic can flag likely instances (see staticChecks.ts). */
  hasStaticDetector: boolean;
}

/**
 * v1 checklist: pure script-body checks only, adapted from the internal
 * sn-review checklist and trimmed to what's answerable from script source +
 * the record metadata already sitting on the same XML record (table, when,
 * condition, active, client_callable). Nothing here requires joining to
 * ACLs, REST Message records, or sys_properties — see CFG-* cuts.
 */
export const CHECKLIST: Check[] = [
  // --- Security ---
  {
    id: "SEC-01",
    category: "security",
    severity: "critical",
    title: "GlideRecord query injection",
    description:
      "User-supplied input concatenated directly into a GlideRecord query (addEncodedQuery, or string-built query) without sanitization.",
    hasStaticDetector: true,
  },
  {
    id: "SEC-02",
    category: "security",
    severity: "critical",
    title: "Script injection (eval / GlideEvaluator)",
    description:
      "Dynamic code execution — eval(), GlideEvaluator, gs.eval() — with input that isn't a fixed literal.",
    hasStaticDetector: true,
  },
  {
    id: "SEC-03",
    category: "security",
    severity: "high",
    title: "Cross-site scripting (XSS)",
    description:
      "Unsanitized field values or user input written into HTML/DOM (innerHTML, document.write, unescaped Jelly output) in a client script, UI page, or UI macro.",
    hasStaticDetector: true,
  },
  {
    id: "SEC-04",
    category: "security",
    severity: "critical",
    title: "Access control bypass",
    description:
      "Missing role checks on privileged operations, or GlideAjax methods that perform admin actions without validating the caller.",
    hasStaticDetector: false,
  },
  {
    id: "SEC-05",
    category: "security",
    severity: "critical",
    title: "Hardcoded credentials",
    description:
      "Passwords, API keys, tokens, or embedded basic-auth URLs (https://user:pass@host) left in the script body instead of a REST Message auth profile or secure property.",
    hasStaticDetector: true,
  },
  {
    id: "SEC-06",
    category: "security",
    severity: "high",
    title: "Unprotected GlideAjax endpoint",
    description:
      "A script include extending AbstractAjaxProcessor with a client-callable method that takes a table name, sys_id, or query as a parameter without validating it.",
    hasStaticDetector: false,
  },
  {
    id: "SEC-07",
    category: "security",
    severity: "high",
    title: "Insecure mass GlideRecord operation",
    description:
      "deleteMultiple() or updateMultiple() called with no query conditions, or with conditions built from user-controlled input.",
    hasStaticDetector: true,
  },
  {
    id: "SEC-08",
    category: "security",
    severity: "high",
    title: "Elevation of privilege",
    description:
      "setWorkflow(false) or autoSysFields(false) suppressing the audit trail, or code that runs in/modifies the system security context.",
    hasStaticDetector: true,
  },
  {
    id: "SEC-09",
    category: "security",
    severity: "medium",
    title: "Direct SQL / GlideDBQuery bypass",
    description:
      "Direct database access (GlideDBQuery, raw JDBC) that bypasses ACLs, business rules, and audit logging.",
    hasStaticDetector: true,
  },

  // --- Code quality ---
  {
    id: "CQ-03",
    category: "quality",
    severity: "medium",
    title: "Null / undefined safety",
    description:
      "Fields accessed on a GlideRecord before checking next()/get() succeeded, or JSON.parse() without a try/catch.",
    hasStaticDetector: false,
  },
  {
    id: "CQ-04",
    category: "quality",
    severity: "low",
    title: "Script include structure",
    description:
      "Missing Class.create() wrapper, prototype assignment, or a type property matching the class name.",
    hasStaticDetector: true,
  },
  {
    id: "CQ-05",
    category: "quality",
    severity: "medium",
    title: "AbstractAjaxProcessor pattern",
    description:
      "GlideAjax-callable script include not using getParameter()-based method dispatch, or missing a type property.",
    hasStaticDetector: false,
  },
  {
    id: "CQ-08",
    category: "quality",
    severity: "medium",
    title: "Error handling",
    description:
      "REST calls or JSON.parse() without try/catch, or an empty catch block that swallows the error with no logging.",
    hasStaticDetector: true,
  },
  {
    id: "CQ-09",
    category: "quality",
    severity: "high",
    title: "Async anti-pattern",
    description:
      "Promise, async/await, or setTimeout()/setInterval() used in server-side script — these don't work in ServiceNow's synchronous server engine.",
    hasStaticDetector: true,
  },

  // --- Performance ---
  {
    id: "PERF-01",
    category: "performance",
    severity: "high",
    title: "GlideRecord query inside a loop",
    description:
      "new GlideRecord(...) instantiated and queried inside a while/for loop — an N+1 pattern. Should be batched with addQuery('sys_id', 'IN', ...).",
    hasStaticDetector: true,
  },
  {
    id: "PERF-02",
    category: "performance",
    severity: "medium",
    title: "Missing query limit",
    description:
      "A query against a large transactional table (incident, task, sys_audit, syslog, sys_email) with no setLimit() or chooseWindow().",
    hasStaticDetector: false,
  },
  {
    id: "PERF-03",
    category: "performance",
    severity: "medium",
    title: "getRowCount() instead of GlideAggregate",
    description:
      "gr.getRowCount() fetches every row just to count them. Use GlideAggregate with COUNT instead.",
    hasStaticDetector: true,
  },
];

export const CHECKLIST_BY_ID: Record<string, Check> = Object.fromEntries(
  CHECKLIST.map((c) => [c.id, c])
);
