"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, Volume1, PhoneIncoming, Loader2 } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import type { CallView } from "@/lib/types";

type Phase = "idle" | "outgoing" | "incoming" | "connecting" | "active" | "ended" | "error";
type Role = "customer" | "driver";

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

function candidateToJson(c: RTCIceCandidate) {
  return JSON.stringify(c.toJSON ? c.toJSON() : c);
}

export function CallDock({
  orderId,
  role,
  peerName,
  watch = false,
  enabled = true,
  className = "",
}: {
  orderId?: string;
  role: Role;
  peerName?: string;
  /** Couriers poll for an incoming call even when no order id is known yet. */
  watch?: boolean;
  enabled?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("idle");
  const [call, setCall] = useState<CallView | null>(null);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const remoteSetRef = useRef(false);
  const answeredRef = useRef(false);
  const pendingIce = useRef<string[]>([]);
  const ringerRef = useRef<{ ctx: AudioContext; timer: number } | null>(null);

  const stopRinger = useCallback(() => {
    const r = ringerRef.current;
    if (!r) return;
    window.clearInterval(r.timer);
    void r.ctx.close().catch(() => undefined);
    ringerRef.current = null;
  }, []);

  const teardown = useCallback((next: Phase = "ended", note = "") => {
    callIdRef.current = null;
    stopRinger();
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current?.getTracks().forEach((track) => track.stop());
    localRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    remoteSetRef.current = false;
    answeredRef.current = false;
    pendingIce.current = [];
    setMuted(false);
    setSeconds(0);
    setMessage(note);
    setPhase(next);
  }, [stopRinger]);

  const startRinger = useCallback(() => {
    if (ringerRef.current) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = 0.06;
      gain.connect(ctx.destination);
      const beep = () => {
        const osc = ctx.createOscillator();
        osc.frequency.value = 520;
        osc.connect(gain);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      };
      beep();
      const timer = window.setInterval(() => {
        beep();
        window.setTimeout(beep, 420);
      }, 2400);
      ringerRef.current = { ctx, timer };
    } catch {
      // Audio autoplay may be blocked for the first ring; the UI is enough.
    }
  }, []);

  const callIdRef = useRef<string | null>(null);

  const post = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const response = await fetch(`/api/calls/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ as: role, ...body }),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { call?: CallView };
      return data.call ?? null;
    },
    [role],
  );

  const ensurePeer = useCallback(async () => {
    if (pcRef.current) return pcRef.current;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser cannot make calls");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    localRef.current = stream;
    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const json = candidateToJson(event.candidate);
      const id = callIdRef.current;
      if (id) void post(id, { candidate: json });
    };
    pc.ontrack = (event) => {
      if (audioRef.current) {
        audioRef.current.srcObject = event.streams[0];
        void audioRef.current.play().catch(() => undefined);
      }
      setPhase("active");
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") teardown("ended", t("Call failed — check your connection"));
    };
    return pc;
  }, [post, t, teardown]);

  const applyRemote = useCallback(async (remote: CallView) => {
    const pc = pcRef.current;
    if (!pc || !remote.remoteSdp) return;
    if (!remoteSetRef.current) {
      await pc.setRemoteDescription({ type: remote.remoteSdpType ?? "offer", sdp: remote.remoteSdp });
      remoteSetRef.current = true;
      for (const raw of remote.remoteCandidates) {
        try {
          await pc.addIceCandidate(JSON.parse(raw));
        } catch {
          // Late or duplicate candidates are harmless.
        }
      }
      pendingIce.current = [];
      if ((remote.remoteSdpType ?? "offer") === "offer" && !answeredRef.current) {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        answeredRef.current = true;
        if (callIdRef.current) {
          await post(callIdRef.current, { sdp: answer.sdp, sdpType: "answer" });
        }
      }
    } else if (remote.remoteCandidates.length) {
      const seen = pendingIce.current.length;
      for (const raw of remote.remoteCandidates.slice(seen)) {
        try {
          await pc.addIceCandidate(JSON.parse(raw));
        } catch {
          // ignore
        }
      }
      pendingIce.current = remote.remoteCandidates;
    }
  }, [post]);

  const handleView = useCallback(
    (view: CallView) => {
      setCall(view);
      if (view.status === "ended") return teardown("ended", t("Call ended"));
      if (view.status === "declined") return teardown("ended", t("Call declined"));
      if (view.status === "missed") return teardown("ended", t("No answer"));
      if (view.status === "active") {
        setPhase((current) => (current === "active" ? current : "connecting"));
        void applyRemote(view);
      }
    },
    [applyRemote, t, teardown],
  );

  // Poll the call while it is alive.
  useEffect(() => {
    const id = callIdRef.current;
    if (!id) return;
    let running = true;
    const tick = async () => {
      const response = await fetch(`/api/calls/${id}?as=${role}`, { cache: "no-store" });
      if (!running) return;
      if (!response.ok) return teardown("ended", t("Call ended"));
      const data = (await response.json()) as { call?: CallView };
      if (data.call) handleView(data.call);
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 1200);
    return () => {
      running = false;
      window.clearInterval(timer);
    };
  }, [call?.id, role, handleView, t, teardown]);

  // Ringtone while the other side has not answered yet.
  useEffect(() => {
    if (phase === "outgoing" || phase === "incoming") startRinger();
    else stopRinger();
  }, [phase, startRinger, stopRinger]);

  // Call duration.
  useEffect(() => {
    if (phase !== "active") return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => () => teardown("idle"), [teardown]);

  const start = useCallback(async () => {
    if (!orderId) return;
    setMessage("");
    setPhase("outgoing");
    try {
      const pc = await ensurePeer();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const response = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, as: role }),
      });
      const data = (await response.json()) as { call?: CallView; error?: string };
      if (!response.ok || !data.call) {
        teardown("error", data.error ?? t("Could not start the call"));
        return;
      }
      callIdRef.current = data.call.id;
      setCall(data.call);
      await post(data.call.id, { sdp: offer.sdp, sdpType: "offer" });
      startRinger();
    } catch (error) {
      teardown("error", error instanceof Error ? error.message : t("Could not start the call"));
    }
  }, [ensurePeer, orderId, post, role, startRinger, t, teardown]);

  const accept = useCallback(async () => {
    const id = call?.id ?? callIdRef.current;
    if (!id) return;
    setMessage("");
    setPhase("connecting");
    stopRinger();
    try {
      await ensurePeer();
      await post(id, { action: "accept" });
    } catch (error) {
      teardown("error", error instanceof Error ? error.message : t("Could not answer the call"));
    }
  }, [call?.id, ensurePeer, post, stopRinger, t, teardown]);

  const hangup = useCallback(async () => {
    const id = call?.id ?? callIdRef.current;
    if (id) void post(id, { action: "end" });
    callIdRef.current = null;
    teardown("ended", t("Call ended"));
  }, [call?.id, post, t, teardown]);

  // Incoming calls: couriers watch every active delivery, customers watch theirs.
  useEffect(() => {
    if (!enabled || phase !== "idle") return;
    let running = true;
    const check = async () => {
      const query = orderId ? `?orderId=${encodeURIComponent(orderId)}` : "";
      const response = await fetch(`/api/calls${query}`, { cache: "no-store" });
      if (!running || !response.ok) return;
      const data = (await response.json()) as { call?: CallView | null };
      const incoming = data.call;
      if (!incoming || incoming.status !== "ringing") return;
      if (incoming.initiatedBy === role) return;
      callIdRef.current = incoming.id;
      setCall(incoming);
      setPhase("incoming");
    };
    void check();
    const timer = window.setInterval(() => void check(), 2500);
    return () => {
      running = false;
      window.clearInterval(timer);
    };
  }, [enabled, orderId, phase, role]);

  const toggleMute = useCallback(() => {
    const tracks = localRef.current?.getAudioTracks() ?? [];
    const next = !muted;
    tracks.forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  /**
   * Route the remote audio to the loudspeaker. Chrome/Android honour
   * setSinkId; iOS switches to the speaker when the media element plays inside
   * a user gesture, so we also bump the volume and keep the element attached.
   */
  const toggleSpeaker = useCallback(async () => {
    const element = audioRef.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    const next = !speaker;
    if (element) {
      element.volume = 1;
      if (typeof element.setSinkId === "function") {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const outputs = devices.filter((device) => device.kind === "audiooutput");
          const loud = outputs.find((device) => /speaker|loud|haut-parleur/i.test(device.label));
          const earpiece = outputs.find((device) => /earpiece|receiver|headset|casque|écouteur/i.test(device.label));
          const target = (next ? loud : earpiece) ?? outputs.find((device) => device.deviceId === "default") ?? outputs[0];
          await element.setSinkId(target?.deviceId ?? "");
        } catch {
          // Fall back to plain playback below.
        }
      }
      void element.play().catch(() => undefined);
    }
    setSpeaker(next);
  }, [speaker]);

  const peer = peerName || (role === "customer" ? t("courier") : t("customer"));
  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (phase === "idle") {
    if (!enabled || watch) return null;
    return (
      <button type="button" onClick={() => void start()} className={`btn btn-ghost btn-sm ${className}`}>
        <Phone size={14} /> {t("Call")} {peer}
      </button>
    );
  }

  if (phase === "ended" || phase === "error") {
    return (
      <div className={`rounded-[10px] border border-line bg-surface px-3 py-2 text-[11px] text-muted ${className}`}>
        {message || t("Call ended")}
        <button type="button" onClick={() => setPhase("idle")} className="ms-2 font-semibold text-brand">
          {t("Close")}
        </button>
      </div>
    );
  }

  return (
    <>
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <div className="fixed inset-x-3 bottom-4 z-50 sm:inset-x-auto sm:end-6 sm:w-[320px]">
        <div className="card overflow-hidden p-4 shadow-xl">
          <div className="flex items-center gap-3">
            <span className={`grid h-11 w-11 place-items-center rounded-full ${phase === "incoming" ? "bg-success-soft text-success" : "bg-brand-soft text-brand"}`}>
              {phase === "incoming" ? <PhoneIncoming size={19} /> : phase === "outgoing" ? <Loader2 size={19} className="animate-spin" /> : <Phone size={19} />}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{peer}</div>
              <div className="text-[11px] text-muted">
                {phase === "incoming"
                  ? t("Incoming call")
                  : phase === "outgoing"
                    ? t("Calling…")
                    : phase === "connecting"
                      ? t("Connecting…")
                      : seconds > 0
                        ? mmss
                        : t("Connected")}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            {phase === "incoming" ? (
              <>
                <button type="button" onClick={() => void accept()} className="btn btn-primary btn-sm flex-1">
                  <Phone size={14} /> {t("Answer")}
                </button>
                <button type="button" onClick={() => void hangup()} className="btn btn-ghost btn-sm flex-1">
                  <PhoneOff size={14} /> {t("Decline")}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleMute}
                  disabled={phase !== "active"}
                  className="btn btn-ghost btn-sm"
                  aria-pressed={muted}
                  title={muted ? t("Unmute") : t("Mute")}
                >
                  {muted ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
                <button
                  type="button"
                  onClick={() => void toggleSpeaker()}
                  disabled={phase !== "active"}
                  className="btn btn-ghost btn-sm"
                  aria-pressed={speaker}
                  title={t("Speaker")}
                >
                  {speaker ? <Volume2 size={15} /> : <Volume1 size={15} />}
                  <span className="hidden sm:inline">{t("Speaker")}</span>
                </button>
                <button type="button" onClick={() => void hangup()} className="btn btn-sm flex-1 bg-danger text-white">
                  <PhoneOff size={14} /> {t("End")}
                </button>
              </>
            )}
          </div>
          <p className="mt-2 text-center text-[10px] text-muted">{t("Calls use your internet connection")}</p>
        </div>
      </div>
    </>
  );
}
