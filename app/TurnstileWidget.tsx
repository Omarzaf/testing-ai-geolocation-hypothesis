"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileWidgetProps = {
  language: "en" | "ur";
  onToken: (token: string) => void;
  labels: {
    loading: string;
    unavailable: string;
  };
};

const SCRIPT_ID = "cloudflare-turnstile-api";

export function TurnstileWidget({ language, onToken, labels }: TurnstileWidgetProps) {
  const [siteKey, setSiteKey] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/config")
      .then(async (response) => {
        const payload = (await response.json()) as { turnstileSiteKey?: string };
        if (!response.ok || !payload.turnstileSiteKey) throw new Error("turnstile-config");
        if (active) setSiteKey(payload.turnstileSiteKey);
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    const container = containerRef.current;
    let widgetId = "";

    function renderWidget() {
      if (!window.turnstile || !container.isConnected || widgetId) return;
      widgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        action: "benchmark-submit",
        language,
        theme: "light",
        callback: (token: unknown) => onToken(typeof token === "string" ? token : ""),
        "expired-callback": () => onToken(""),
        "error-callback": () => {
          onToken("");
          setUnavailable(true);
        },
      });
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (window.turnstile) {
      renderWidget();
    } else if (existing) {
      existing.addEventListener("load", renderWidget, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderWidget, { once: true });
      script.addEventListener("error", () => setUnavailable(true), { once: true });
      document.head.append(script);
    }

    return () => {
      existing?.removeEventListener("load", renderWidget);
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      onToken("");
    };
  }, [language, onToken, siteKey]);

  return (
    <div className="turnstile-field">
      <div ref={containerRef} />
      <p aria-live="polite">{unavailable ? labels.unavailable : !siteKey ? labels.loading : ""}</p>
    </div>
  );
}
