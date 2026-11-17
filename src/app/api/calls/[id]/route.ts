import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { actOnCall, readCall, pushSignal, type CallAction } from "@/lib/calls";
import type { CallRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: CallAction[] = ["accept", "decline", "end"];

function roleFor(request: Request, claimed?: string | null): CallRole {
  if (getSessionFromRequest(request)?.role === "driver") return "driver";
  return claimed === "driver" ? "driver" : "customer";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const role = roleFor(request, new URL(request.url).searchParams.get("as"));
  const call = readCall(id, role);
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  return NextResponse.json({ call });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        as?: string;
        action?: string;
        sdp?: string;
        sdpType?: "offer" | "answer";
        candidate?: string;
      }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const role = roleFor(request, body.as);
  if (role === "driver" && !getSessionFromRequest(request)) {
    return NextResponse.json({ error: "Please sign in as a courier" }, { status: 401 });
  }

  if (body.action) {
    if (!ACTIONS.includes(body.action as CallAction)) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    const call = actOnCall(id, role, body.action as CallAction);
    if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
    return NextResponse.json({ ok: true, call });
  }

  if (!body.sdp && !body.candidate) {
    return NextResponse.json({ error: "Nothing to signal" }, { status: 400 });
  }
  const call = pushSignal(id, role, {
    sdp: body.sdp,
    sdpType: body.sdpType,
    candidate: body.candidate,
  });
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  return NextResponse.json({ ok: true, call });
}
