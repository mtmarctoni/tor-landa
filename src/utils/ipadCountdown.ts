type IpadPlacement = "hidden" | "reveal" | "inline";
type IpadContent = "pending" | "shopping-open" | "purchased" | "invalid";

export interface IpadCountdownModel {
  placement: IpadPlacement;
  content: IpadContent;
  remaining: { days: number; hours: number; minutes: number } | null;
  targetLabel: string | null;
  isTargetDay: boolean;
  nextBoundaryAt: number | null;
}

// Date.parse normalizes impossible dates such as February 30; reject them first.
function parseInstant(value: unknown): number {
  if (typeof value !== "string") return NaN;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match) return NaN;
  const [, y, m, d, h, min, sec] = match;
  const daysInMonth = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  if (
    Number(m) < 1 ||
    Number(m) > 12 ||
    Number(d) < 1 ||
    Number(d) > daysInMonth ||
    Number(h) > 23 ||
    Number(min) > 59 ||
    Number(sec) > 59
  )
    return NaN;
  return Date.parse(value);
}

export function deriveIpadCountdown(
  config: unknown,
  nowMs: number,
): IpadCountdownModel {
  const result: IpadCountdownModel = {
    placement: "hidden",
    content: "invalid",
    remaining: null,
    targetLabel: null,
    isTargetDay: false,
    nextBoundaryAt: null,
  };
  if (!Number.isFinite(nowMs) || !config || typeof config !== "object")
    return result;
  const values = config as Record<string, unknown>;
  const reveal = parseInstant(values.revealAt);
  const inline = parseInstant(values.inlineAt);
  if (!Number.isFinite(reveal) || !Number.isFinite(inline) || reveal >= inline)
    return result;
  result.placement =
    nowMs < reveal ? "hidden" : nowMs < inline ? "reveal" : "inline";
  result.nextBoundaryAt =
    nowMs < reveal ? reveal : nowMs < inline ? inline : null;
  const target = parseInstant(values.targetAt);
  if (
    !Number.isFinite(target) ||
    target <= inline ||
    typeof values.timeZone !== "string" ||
    (values.purchaseStatus !== "pending" &&
      values.purchaseStatus !== "purchased")
  )
    return result;

  let dayFormat: Intl.DateTimeFormat;
  let labelFormat: Intl.DateTimeFormat;
  try {
    dayFormat = new Intl.DateTimeFormat("en-CA", {
      timeZone: values.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    labelFormat = new Intl.DateTimeFormat("es-ES", {
      timeZone: values.timeZone,
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    // Also rejects finite but out-of-range Date values without throwing to UI.
    dayFormat.format(nowMs);
  } catch {
    return result;
  }
  const parts = labelFormat.formatToParts(target);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value;
  result.targetLabel = `${part("day")} ${part("month")} ${part("year")} · ${part("hour")}:${part("minute")} · hora de Palma`;
  result.isTargetDay = dayFormat.format(nowMs) === dayFormat.format(target);
  if (values.purchaseStatus === "purchased") {
    result.content = "purchased";
    return result;
  }
  if (nowMs < target) {
    const minutes = Math.ceil(Math.max(0, target - nowMs) / 60_000);
    result.content = "pending";
    result.remaining = {
      days: Math.floor(minutes / 1440),
      hours: Math.floor(minutes / 60) % 24,
      minutes: minutes % 60,
    };
    result.nextBoundaryAt ??= target;
    return result;
  }
  result.content = "shopping-open";
  if (result.isTargetDay) {
    // Find the end of this one target day in its display zone, never the device's.
    let low = target;
    let high = target + 36 * 60 * 60 * 1000;
    const targetDay = dayFormat.format(target);
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (dayFormat.format(middle) === targetDay) low = middle;
      else high = middle;
    }
    result.nextBoundaryAt = high;
  }
  return result;
}
