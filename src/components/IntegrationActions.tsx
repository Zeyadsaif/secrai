"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConnectButton() {
  return (
    <a href="/api/microsoft/consent" className="btn btn-primary">
      Connect Microsoft tenant
    </a>
  );
}

export function SyncButton({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string>("");

  async function sync() {
    setState("running");
    setMsg("");
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error || "Sync failed");
      setState("done");
      setMsg(`${body.findings} findings · ${body.assets} assets${body.score != null ? ` · score ${body.score}` : ""}`);
      router.refresh();
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "Sync failed");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={sync} disabled={state === "running"} className="btn">
        {state === "running" ? "Syncing…" : "Sync now"}
      </button>
      {msg && <span className={`text-xs ${state === "error" ? "text-sev-critical" : "text-white/50"}`}>{msg}</span>}
    </div>
  );
}
