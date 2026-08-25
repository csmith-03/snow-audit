import type { ScriptType } from "./types";

/**
 * Maps the ServiceNow tables this audit covers to our internal ScriptType
 * and the field(s) on that table that hold script source.
 *
 * v1 scope is intentionally narrow: pure code-review targets only. No ACLs,
 * REST Message records, or sys_properties — those need cross-referencing
 * other tables and are cut from the dev/code audit.
 *
 * Source: ServiceNow record type field mapping (sys_update_xml `type` value
 * is the authoritative table name — don't parse it out of `name`).
 */
export interface RecordTypeDef {
  scriptType: ScriptType;
  /** sys_update_xml `type` field value for this table. */
  table: string;
  /** Field(s) on the inner payload record containing script source. */
  scriptFields: string[];
  label: string;
}

export const SUPPORTED_RECORD_TYPES: RecordTypeDef[] = [
  {
    scriptType: "business_rule",
    table: "sys_script",
    scriptFields: ["script"],
    label: "Business Rule",
  },
  {
    scriptType: "client_script",
    table: "sys_script_client",
    scriptFields: ["script"],
    label: "Client Script",
  },
  {
    scriptType: "script_include",
    table: "sys_script_include",
    scriptFields: ["script"],
    label: "Script Include",
  },
  {
    scriptType: "ui_action",
    table: "sys_ui_action",
    scriptFields: ["script", "client_script"],
    label: "UI Action",
  },
];

export const TABLE_TO_RECORD_TYPE: Record<string, RecordTypeDef> =
  Object.fromEntries(SUPPORTED_RECORD_TYPES.map((rt) => [rt.table, rt]));

/**
 * Some Update Set exports leave `source_table` blank/nonstandard but always
 * populate `<type>` with the human-readable label ("Business Rule", "Script
 * Include", ...). Keyed lowercase for case-insensitive lookup.
 */
export const LABEL_TO_RECORD_TYPE: Record<string, RecordTypeDef> =
  Object.fromEntries(
    SUPPORTED_RECORD_TYPES.map((rt) => [rt.label.toLowerCase(), rt])
  );

export const SCRIPT_TYPE_LABELS: Record<ScriptType, string> =
  Object.fromEntries(
    SUPPORTED_RECORD_TYPES.map((rt) => [rt.scriptType, rt.label])
  ) as Record<ScriptType, string>;
