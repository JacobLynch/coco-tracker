"use client";

import { useEffect, useState } from "react";

export default function WidgetPage() {
  const [baseUrl, setBaseUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const installUrl = baseUrl ? `${baseUrl}/widget-install` : "#";
  const shareUrl = baseUrl ? `${baseUrl}/widget` : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 select-none">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-10">
          <span className="relative flex h-1.5 w-1.5">
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-[11px] tracking-[0.3em] uppercase text-zinc-500 font-medium">
            Coco Capital
          </span>
        </div>

        <h1 className="text-2xl font-medium text-white mb-3 tracking-tight">
          iOS Widget
        </h1>
        <p className="text-sm text-zinc-500 mb-10 leading-relaxed max-w-xs">
          Add your fund balance to your iPhone home screen with Scriptable.
        </p>

        {/* Steps */}
        <div className="w-full space-y-4 mb-10 text-left">
          <Step n={1}>
            <span className="text-zinc-400">Install </span>
            <a
              href="https://apps.apple.com/app/scriptable/id1405459188"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 underline underline-offset-2"
            >
              Scriptable
            </a>
            <span className="text-zinc-400"> (free)</span>
          </Step>
          <Step n={2}>
            <a
              href={installUrl}
              className="text-emerald-400 underline underline-offset-2"
            >
              Tap here to add the script
            </a>
            <span className="text-zinc-500">
              {" "}— opens in Scriptable
            </span>
          </Step>
          <Step n={3}>
            <span className="text-zinc-400">
              Long-press your home screen, tap{" "}
              <span className="text-zinc-300">+</span>, search for{" "}
              <span className="text-zinc-300">Scriptable</span>, add a small
              widget
            </span>
          </Step>
          <Step n={4}>
            <span className="text-zinc-400">
              Long-press the new widget, tap{" "}
              <span className="text-zinc-300">Edit Widget</span>, select{" "}
              <span className="text-zinc-300">&quot;Coco Capital&quot;</span>
            </span>
          </Step>
        </div>

        {/* Divider */}
        <div className="w-12 h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent mb-8" />

        {/* Share */}
        <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-700 mb-3 font-medium">
          Share with someone
        </p>
        <p className="text-xs text-zinc-600 mb-4">
          Send them this page and they can set it up in under a minute.
        </p>
        <button
          onClick={handleCopy}
          className="px-5 py-2.5 text-xs font-medium rounded-xl bg-white/[0.06] text-zinc-400 ring-1 ring-white/[0.08] hover:bg-white/[0.1] hover:text-zinc-300 transition-all active:scale-95 cursor-pointer"
        >
          {copied ? "Copied!" : "Copy page link"}
        </button>
      </div>
    </main>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/[0.06] ring-1 ring-white/[0.08] flex items-center justify-center text-[11px] font-semibold text-zinc-500">
        {n}
      </span>
      <p className="text-[13px] leading-relaxed pt-0.5">{children}</p>
    </div>
  );
}
