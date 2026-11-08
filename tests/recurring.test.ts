import { describe, expect, it } from "vitest";
import { nextRecurringRun } from "@/lib/db";

describe("recurring orders", () => {
  const base = new Date("2026-11-08T09:00:00.000Z");

  it("advances daily schedules by one day", () => {
    expect(nextRecurringRun("daily", undefined, base).toISOString()).toBe(
      "2026-11-09T09:00:00.000Z",
    );
  });

  it("advances weekly schedules by seven days", () => {
    expect(nextRecurringRun("weekly", undefined, base).toISOString()).toBe(
      "2026-11-15T09:00:00.000Z",
    );
  });

  it("advances custom schedules by the chosen interval", () => {
    expect(nextRecurringRun("custom", 3, base).toISOString()).toBe(
      "2026-11-11T09:00:00.000Z",
    );
  });

  it("advances monthly schedules into the next month", () => {
    expect(nextRecurringRun("monthly", undefined, base).toISOString()).toBe(
      "2026-12-08T09:00:00.000Z",
    );
  });
});
