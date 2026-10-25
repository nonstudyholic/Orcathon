import type { Anomaly } from "@/types";
import type { RGB, Region } from "./detectChanges";

// Simple color and shape rules. These are rough guesses used when the AI step
// is unavailable, and as a first label while the AI step runs. They are not
// calibrated probabilities, so confidence is capped low.

const isVegetation = (c: RGB) => c.g > c.r * 1.04 && c.g > c.b * 1.08;
const isWater = (c: RGB) => c.b > c.r * 1.12 && c.b >= c.g * 0.98 && (c.r + c.g + c.b) / 3 < 150;
const isBareSoil = (c: RGB) => c.r > c.b + 14 && c.r >= c.g * 0.98 && !isVegetation(c);

export function classifyByRules(region: Region): Anomaly {
  const { before, after, fill, meanDiff } = region;
  const strength = Math.min(0.8, 0.35 + meanDiff / 200);

  const base = { id: region.id, box: region.box, source: "rules" as const };

  if (isWater(before) !== isWater(after)) {
    return {
      ...base,
      kind: "coastal_shift",
      origin: "natural",
      confidence: strength,
      reason: "Area changed between water-like and land-like colors.",
    };
  }

  if (isVegetation(before) && !isVegetation(after)) {
    if (isBareSoil(after) && fill > 0.55) {
      return {
        ...base,
        kind: "excavation",
        origin: "human",
        confidence: strength,
        reason: "Green area became compact bare soil.",
      };
    }
    if (fill > 0.65) {
      return {
        ...base,
        kind: "forest_loss",
        origin: "human",
        confidence: strength,
        reason: "Vegetation removed in a compact, regular shape, which often means clearing.",
      };
    }
    return {
      ...base,
      kind: "forest_loss",
      origin: "natural",
      confidence: Math.min(strength, 0.6),
      reason: "Vegetation lost in an irregular shape, which can mean fire, storm, or disease.",
    };
  }

  if (isBareSoil(after) && !isBareSoil(before)) {
    return {
      ...base,
      kind: "excavation",
      origin: "human",
      confidence: Math.min(strength, 0.6),
      reason: "New bare-soil colors appeared.",
    };
  }

  return {
    ...base,
    kind: "unclassified",
    origin: "unknown",
    confidence: 0.3,
    reason: "Surface changed, but the colors do not match a known pattern.",
  };
}
