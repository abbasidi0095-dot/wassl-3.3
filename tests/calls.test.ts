import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/security", () => ({
  randomId: (() => {
    let n = 0;
    return () => `call_test_${++n}`;
  })(),
}));

import { actOnCall, findLiveCall, openCall, pushSignal, readCall } from "@/lib/calls";

beforeEach(() => {
  // Each test uses a fresh order id so the in-memory store never leaks.
  vi.useRealTimers();
});

describe("call signalling", () => {
  it("opens a ringing call and lets the courier accept it", () => {
    const call = openCall("order_a", "W-100", "customer");
    expect(call.status).toBe("ringing");

    const asDriver = readCall(call.id, "driver");
    expect(asDriver?.status).toBe("ringing");
    expect(asDriver?.ringSecondsLeft).toBeGreaterThan(0);

    const accepted = actOnCall(call.id, "driver", "accept");
    expect(accepted?.status).toBe("active");
  });

  it("reuses the live call for the same order instead of stacking", () => {
    const first = openCall("order_b", "W-101", "customer");
    const second = openCall("order_b", "W-101", "driver");
    expect(second.id).toBe(first.id);
  });

  it("exchanges offer, answer and candidates in the right direction", () => {
    const call = openCall("order_c", "W-102", "customer");
    actOnCall(call.id, "driver", "accept");

    pushSignal(call.id, "customer", { sdp: "offer-sdp", sdpType: "offer" });
    const driverView = readCall(call.id, "driver");
    expect(driverView?.remoteSdp).toBe("offer-sdp");
    expect(driverView?.remoteSdpType).toBe("offer");

    pushSignal(call.id, "driver", { sdp: "answer-sdp", sdpType: "answer" });
    pushSignal(call.id, "driver", { candidate: "cand-1" });
    const customerView = readCall(call.id, "customer");
    expect(customerView?.remoteSdp).toBe("answer-sdp");
    expect(customerView?.remoteCandidates).toEqual(["cand-1"]);
  });

  it("declines and ends cleanly, and stops advertising the call", () => {
    const call = openCall("order_d", "W-103", "customer");
    expect(actOnCall(call.id, "driver", "decline")?.status).toBe("declined");
    expect(findLiveCall("order_d", "customer")).toBeUndefined();

    const second = openCall("order_e", "W-104", "customer");
    actOnCall(second.id, "customer", "end");
    expect(readCall(second.id, "customer")?.status).toBe("ended");
  });

  it("marks an unanswered call as missed after the ring window", () => {
    vi.useFakeTimers();
    const call = openCall("order_f", "W-105", "customer");
    vi.advanceTimersByTime(46_000);
    const view = readCall(call.id, "driver");
    expect(view?.status).toBe("missed");
    vi.useRealTimers();
  });
});
