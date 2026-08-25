import { SEVERITY_WEIGHT, type Finding } from "./types";

/**
 * 0-100 instance risk score. Diminishing weight isn't modeled yet — this is
 * a simple capped sum, good enough for v1 ordering. Findings below the
 * confidence floor don't count toward the score, only toward the "show all"
 * view, so noisy static detectors can't inflate the headline number.
 */
export const DEFAULT_CONFIDENCE_FLOOR = 50;

export function computeRiskScore(
  findings: Finding[],
  confidenceFloor = DEFAULT_CONFIDENCE_FLOOR
): number {
  const counted = findings.filter((f) => f.aiConfidence >= confidenceFloor);
  const raw = counted.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  return Math.min(100, raw);
}

export function riskBand(score: number): { label: string; tone: "critical" | "warn" | "ok" } {
  if (score >= 60) return { label: "High risk", tone: "critical" };
  if (score >= 25) return { label: "Needs attention", tone: "warn" };
  return { label: "Low risk", tone: "ok" };
}
