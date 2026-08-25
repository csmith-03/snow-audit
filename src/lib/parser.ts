import { XMLParser } from "fast-xml-parser";
import type { Script, ScriptSource } from "./types";
import {
  TABLE_TO_RECORD_TYPE,
  LABEL_TO_RECORD_TYPE,
  type RecordTypeDef,
} from "./recordTypes";

// Update Set exports are XML-in-XML: the outer <sys_update_xml> envelope
// carries a <payload> whose CDATA is itself an XML document for the actual
// record. We parse in two passes. Real-world exports vary slightly in
// wrapper shape (some omit <record_update>, field names differ per table),
// so this is best-effort with a fallback chain rather than a strict schema.

const xmlOpts = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false, // keep everything as strings; we coerce ourselves
  trimValues: false,
};

const outerParser = new XMLParser(xmlOpts);
const innerParser = new XMLParser(xmlOpts);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export interface ParseResult {
  scripts: Script[];
  /** Records found in the update set but outside our 4-table scope (config, ACLs, etc). */
  skipped: { name: string; table: string | null }[];
  errors: string[];
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function toBool(v: unknown, fallback: boolean): boolean {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.trim().toLowerCase() === "true";
  return fallback;
}

function textOf(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "object") {
    const obj = v as AnyRecord;
    if ("#text" in obj) return String(obj["#text"]);
    // Empty self-closed tags parse to {} — treat as empty string, not "no value"
    if (Object.keys(obj).length === 0) return "";
    return null;
  }
  return String(v);
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/** payload → the actual record object for `recordDef.table`, tolerating a few wrapper shapes. */
function extractRecord(inner: AnyRecord, recordDef: RecordTypeDef): AnyRecord | null {
  const recordUpdate: AnyRecord = inner.record_update ?? inner;
  if (recordUpdate[recordDef.table]) return recordUpdate[recordDef.table];
  // Some exports skip the <record_update> wrapper and put the table tag at the root.
  if (inner[recordDef.table]) return inner[recordDef.table];
  return null;
}

export function parseUpdateSetXml(xml: string, reportId: string): ParseResult {
  const scripts: Script[] = [];
  const skipped: { name: string; table: string | null }[] = [];
  const errors: string[] = [];

  let outer: AnyRecord;
  try {
    outer = outerParser.parse(xml);
  } catch (e) {
    return {
      scripts,
      skipped,
      errors: [`Could not parse this as XML: ${(e as Error).message}`],
    };
  }

  const root: AnyRecord = outer.unload ?? outer;
  const entries = asArray<AnyRecord>(root?.sys_update_xml);

  if (entries.length === 0) {
    errors.push(
      "No <sys_update_xml> records found. Make sure this is an Update Set XML export (Retrieved Update Sets → export)."
    );
    return { scripts, skipped, errors };
  }

  for (const entry of entries) {
    const targetName =
      textOf(entry.target_name) ?? textOf(entry.name) ?? "(unnamed)";
    const action = textOf(entry.action) ?? textOf(entry["@_action"]);
    if (action && action.toUpperCase() === "DELETE") {
      skipped.push({ name: targetName, table: null });
      continue;
    }

    const sourceTable = textOf(entry.source_table);
    const typeLabel = textOf(entry.type);
    // source_table is the primary signal, but some exports leave it blank or
    // nonstandard — fall back to the human-readable <type> label, which is
    // consistently populated ("Business Rule", "Script Include", ...).
    const recordDef: RecordTypeDef | undefined =
      (sourceTable ? TABLE_TO_RECORD_TYPE[sourceTable] : undefined) ??
      (typeLabel ? LABEL_TO_RECORD_TYPE[typeLabel.toLowerCase()] : undefined);

    if (!recordDef) {
      skipped.push({ name: targetName, table: sourceTable ?? typeLabel });
      continue;
    }

    const payload = textOf(entry.payload);
    if (!payload) {
      errors.push(`${targetName}: no <payload> content found, skipped.`);
      continue;
    }

    let inner: AnyRecord;
    try {
      inner = innerParser.parse(payload);
    } catch (e) {
      errors.push(
        `${targetName}: could not parse payload XML (${(e as Error).message}), skipped.`
      );
      continue;
    }

    const record = extractRecord(inner, recordDef);
    if (!record) {
      errors.push(
        `${targetName}: payload didn't contain a recognizable <${recordDef.table}> record, skipped.`
      );
      continue;
    }

    const sources: ScriptSource[] = [];
    for (const field of recordDef.scriptFields) {
      const code = textOf(record[field]);
      if (code && code.trim().length > 0) {
        sources.push({ field, code });
      }
    }

    const sysId = textOf(record.sys_id) ?? textOf(entry.sys_id) ?? newId();

    scripts.push({
      id: sysId,
      reportId,
      type: recordDef.scriptType,
      name: textOf(record.name) ?? targetName,
      // Business rules use `collection` for the table they run against;
      // client scripts / UI actions use `table`. Script includes have neither.
      table: textOf(record.collection) ?? textOf(record.table) ?? null,
      when: textOf(record.when),
      condition: textOf(record.condition),
      active: toBool(record.active, true),
      clientCallable:
        record.client_callable === undefined
          ? null
          : toBool(record.client_callable, false),
      sysId,
      sources,
    });
  }

  return { scripts, skipped, errors };
}
