import { useEffect, useRef, useState } from 'react';

function websocketUrl(token) {
  const configured = import.meta.env.VITE_API_URL;
  const base = configured ? new URL(configured) : window.location;
  const protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${base.host}/ws/ev?token=${encodeURIComponent(token)}`;
}

export default function useEvLiveUpdates(onEvent) {
  const callbackRef = useRef(onEvent);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || typeof WebSocket === 'undefined') return undefined;

    let socket;
    let retryTimer;
    let stopped = false;
    let retryMs = 1000;

    const connect = () => {
      socket = new WebSocket(websocketUrl(token));
      socket.onopen = () => {
        retryMs = 1000;
        setConnected(true);
      };
      socket.onmessage = (message) => {
        try {
          callbackRef.current?.(JSON.parse(message.data));
        } catch {
          // REST remains the source of truth if a malformed live event arrives.
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        setConnected(false);
        if (!stopped) {
          retryTimer = window.setTimeout(connect, retryMs);
          retryMs = Math.min(retryMs * 2, 15000);
        }
      };
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  return connected;
}
