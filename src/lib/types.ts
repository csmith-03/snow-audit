// Core data model for snow-audit.
// v1 scope: four ServiceNow record types that carry scripted logic.
// (ACLs, REST Message auth, sys_properties, and other config records are
// out of scope for the dev/code audit — see CFG-* cuts in project notes.)

export type ScriptType =
  | "business_rule"
  | "client_script"
  | "script_include"
  | "ui_action";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface ScriptSource {
  /** Field name this source came from, e.g. "script" or "client_script". */
  field: string;
  code: string;
}

export interface Script {
  id: string;
  reportId: string;
  type: ScriptType;
  name: string;
  table: string | null;
  /** Business rule timing: before | after | async | display. Null for other types. */
  when: string | null;
  condition: string | null;
  active: boolean;
  /** Script includes: whether callable from client (GlideAjax risk surface). */
  clientCallable: boolean | null;
  sysId: string;
  /** One or more script bodies — UI Actions carry both server + client script. */
  sources: ScriptSource[];
}

export interface Finding {
  id: string;
  scriptId: string;
  checkId: string; // e.g. "SEC-01"
  severity: Severity;
  summary: string;
  /** Optional line number or search anchor within the source. */
  lineRef: number | null;
  snippet: string;
  /** 0-100. Findings below the report's confidence threshold are hidden by default. */
  aiConfidence: number;
  source: "static" | "ai";
}

export interface ScriptSummary {
  scriptId: string;
  plainEnglishSummary: string;
}

export interface Report {
  id: string;
  instanceName: string;
  status: "parsing" | "analyzing" | "ready" | "error";
  riskScore: number | null;
  createdAt: string;
  scripts: Script[];
  findings: Finding[];
  summaries: ScriptSummary[];
}

export const SEVERITY_ORDER: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 40,
  high: 20,
  medium: 8,
  low: 2,
  info: 0,
};
