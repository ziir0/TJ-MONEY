import React, { useEffect, useRef, useState } from "react";

type TurnstileRenderOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  theme?: "light" | "dark" | "auto";
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  const scriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-turnstile-script="true"]',
    );
    existingScript?.remove();
    const script = document.createElement("script");
    const handleLoad = () => {
      if (window.turnstile) resolve();
      else reject(new Error("Turnstile failed to initialize."));
    };
    const handleError = () => {
      script.remove();
      reject(new Error("Turnstile could not be loaded."));
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = "true";
    document.head.appendChild(script);
  });
  const pending = scriptPromise.catch((error: unknown) => {
    turnstileScriptPromise = null;
    throw error;
  });
  turnstileScriptPromise = pending;
  return pending;
}

export default function AuthCaptcha({
  onToken,
  resetKey,
}: {
  onToken: (token: string | null) => void;
  resetKey: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const [error, setError] = useState<string | null>(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  useEffect(() => {
    let active = true;
    const container = containerRef.current;
    onTokenRef.current(null);

    if (!siteKey) {
      setError("Security verification is not configured. Please contact the administrator.");
      return () => {
        active = false;
      };
    }

    setError(null);
    void loadTurnstile()
      .then(() => {
        if (!active || !container || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(container, {
          sitekey: siteKey,
          theme: "auto",
          callback: (token) => {
            setError(null);
            onTokenRef.current(token);
          },
          "error-callback": () => {
            onTokenRef.current(null);
            setError("Security verification failed to load. Please try again.");
          },
          "expired-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => {
        if (!active) return;
        setError("Security verification is unavailable. Check your connection and try again.");
      });

    return () => {
      active = false;
      onTokenRef.current(null);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [resetKey, siteKey]);

  return (
    <div className="space-y-1">
      <div ref={containerRef} aria-label="Security verification" />
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
