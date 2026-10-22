export interface IpadCountdownConfig {
  revealAt: string;
  inlineAt: string;
  targetAt: string;
  timeZone: string;
  purchaseStatus: "pending" | "purchased";
}

/** One promise, not an annual event. Change only purchaseStatus when bought. */
export const ipadCountdownConfig: IpadCountdownConfig = {
  revealAt: "2026-10-23T00:00:00+02:00",
  inlineAt: "2026-10-24T00:00:00+02:00",
  targetAt: "2026-11-27T00:00:00+01:00",
  timeZone: "Europe/Madrid",
  purchaseStatus: "pending",
};
