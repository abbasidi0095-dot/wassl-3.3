import { randomId } from "./security";
import type { CallRole, CallStatus, CallView } from "./types";

/**
 * Voice calls are peer-to-peer WebRTC; this module only brokers the handshake.
 *
 * The web app runs as a single Node process (`next start`, one machine), so an
 * in-memory store is enough and keeps signalling traffic out of the JSON
 * database. Calls never outlive a process restart — which is correct: a live
 * call cannot survive one either.
 */

const RING_TIMEOUT_MS = 45_000;
const CALL_TTL_MS = 10 * 60_000;
const MAX_CANDIDATES = 40;

type Peer = {
  sdp?: string;
  sdpType?: "offer" | "answer";
  candidates: string[];
};

type Call = {
  id: string;
  orderId: string;
  orderCode: string;
  status: CallStatus;
  initiatedBy: CallRole;
  createdAt: number;
  updatedAt: number;
  endedBy?: CallRole | "system";
  peers: Record<CallRole, Peer>;
};

const calls = new Map<string, Call>();

function peer(): Peer {
  return { candidates: [] };
}

function other(role: CallRole): CallRole {
  return role === "customer" ? "driver" : "customer";
}

function sweep() {
  const now = Date.now();
  for (const [id, call] of calls) {
    if (now - call.updatedAt > CALL_TTL_MS) calls.delete(id);
  }
}

function expire(call: Call) {
  if (call.status === "ringing" && Date.now() - call.createdAt > RING_TIMEOUT_MS) {
    call.status = "missed";
    call.endedBy = "system";
    call.updatedAt = Date.now();
  }
}

function view(call: Call, role: CallRole): CallView {
  const remote = call.peers[other(role)];
  return {
    id: call.id,
    orderId: call.orderId,
    orderCode: call.orderCode,
    status: call.status,
    initiatedBy: call.initiatedBy,
    createdAt: new Date(call.createdAt).toISOString(),
    updatedAt: new Date(call.updatedAt).toISOString(),
    ringSecondsLeft: Math.max(
      0,
      Math.ceil((call.createdAt + RING_TIMEOUT_MS - Date.now()) / 1000),
    ),
    remoteSdp: remote.sdp,
    remoteSdpType: remote.sdpType,
    remoteCandidates: [...remote.candidates],
    endedBy: call.endedBy,
  };
}

/** Reuse a live call for the same order instead of stacking ring tones. */
export function openCall(orderId: string, orderCode: string, initiatedBy: CallRole): Call {
  sweep();
  for (const call of calls.values()) {
    if (call.orderId === orderId && (call.status === "ringing" || call.status === "active")) {
      return call;
    }
  }
  const now = Date.now();
  const call: Call = {
    id: randomId("call", 6),
    orderId,
    orderCode,
    status: "ringing",
    initiatedBy,
    createdAt: now,
    updatedAt: now,
    peers: { customer: peer(), driver: peer() },
  };
  calls.set(call.id, call);
  return call;
}

export function readCall(id: string, role: CallRole): CallView | undefined {
  const call = calls.get(id);
  if (!call) return undefined;
  expire(call);
  return view(call, role);
}

export function findLiveCall(orderId: string, role: CallRole): CallView | undefined {
  sweep();
  for (const call of calls.values()) {
    if (call.orderId === orderId && (call.status === "ringing" || call.status === "active")) {
      expire(call);
      if (call.status === "ringing" || call.status === "active") return view(call, role);
    }
  }
  return undefined;
}

export type CallAction = "accept" | "decline" | "end";

export function actOnCall(
  id: string,
  role: CallRole,
  action: CallAction,
): CallView | undefined {
  const call = calls.get(id);
  if (!call) return undefined;
  expire(call);
  if (action === "accept" && call.status === "ringing") {
    call.status = "active";
    call.updatedAt = Date.now();
  } else if (action === "decline" && call.status === "ringing") {
    call.status = "declined";
    call.endedBy = role;
    call.updatedAt = Date.now();
  } else if (action === "end" && (call.status === "ringing" || call.status === "active")) {
    call.status = "ended";
    call.endedBy = role;
    call.updatedAt = Date.now();
  }
  return view(call, role);
}

/** Store the offer/answer or a trickled ICE candidate posted by one side. */
export function pushSignal(
  id: string,
  role: CallRole,
  payload: { sdp?: string; sdpType?: "offer" | "answer"; candidate?: string },
): CallView | undefined {
  const call = calls.get(id);
  if (!call) return undefined;
  expire(call);
  const me = call.peers[role];
  if (payload.sdp) {
    me.sdp = payload.sdp;
    me.sdpType = payload.sdpType ?? "offer";
  }
  if (payload.candidate && me.candidates.length < MAX_CANDIDATES) {
    me.candidates.push(payload.candidate);
  }
  call.updatedAt = Date.now();
  return view(call, role);
}
