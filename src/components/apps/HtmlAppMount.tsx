import { useEffect, useRef, useState } from "react";
import type { RigSlot } from "../../apps/types";
import type { SlotBackend } from "../../apps/runtime";
import {
  handleSlotRequest,
  injectBootstrap,
  isSlotRequest,
  SLOT_INIT_KIND,
} from "../../apps/htmlBridge";

export interface HtmlAppMountProps {
  /** URI in the rig where the HTML payload lives. */
  htmlUri: string;
  /** The data handle exposed to the iframe over the bridge. */
  slot: RigSlot;
  /** Backend used to fetch the HTML payload itself. */
  backend: SlotBackend;
}

function bytesToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) {
    return new TextDecoder("utf-8", { fatal: false }).decode(value);
  }
  return "";
}

export function HtmlAppMount({ htmlUri, slot, backend }: HtmlAppMountProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the HTML payload once per URI.
  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setError(null);
    (async () => {
      try {
        const [result] = await backend.read<unknown>([htmlUri]);
        if (cancelled) return;
        const payload = result?.[1];
        if (payload == null) {
          setError(`No HTML found at ${htmlUri}`);
          return;
        }
        const source = bytesToString(payload);
        setHtml(injectBootstrap(source));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [htmlUri, backend]);

  // Wire the postMessage bridge once the iframe is in the DOM. Keep `slot`
  // in a ref so we don't have to tear down the listener every basepath
  // edit — the inbound op can route to the latest slot freely.
  const slotRef = useRef(slot);
  useEffect(() => {
    slotRef.current = slot;
  }, [slot]);

  useEffect(() => {
    if (!html) return;
    const handler = async (event: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      // Only honor messages from this iframe's window.
      if (event.source !== iframe.contentWindow) return;
      const request = event.data;
      if (!isSlotRequest(request)) return;
      const reply = await handleSlotRequest(slotRef.current, request);
      iframe.contentWindow?.postMessage(reply, "*");
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [html]);

  // Once the iframe is loaded, send an init message so the app can render.
  const handleLoad = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      { kind: SLOT_INIT_KIND, basePath: slotRef.current.basePath },
      "*",
    );
  };

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive" data-testid="html-mount-error">
        {error}
      </div>
    );
  }
  if (html === null) {
    return (
      <div className="p-4 text-sm text-muted-foreground" data-testid="html-mount-loading">
        Loading app…
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      data-testid="html-mount-iframe"
      title="Mounted app"
      sandbox="allow-scripts"
      srcDoc={html}
      onLoad={handleLoad}
      className="w-full h-full min-h-[60vh] border border-border rounded-md bg-background"
    />
  );
}
