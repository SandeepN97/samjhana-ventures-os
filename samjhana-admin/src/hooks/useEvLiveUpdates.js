import { useEffect, useRef, useState } from 'react';
import api from '../utils/api';

// The socket URL carries a one-time, 30-second ticket rather than the login token: URLs end up in
// proxy logs, and a used-up ticket is worthless to anyone who reads them.
function websocketUrl(ticket) {
  const configured = import.meta.env.VITE_API_URL;
  const base = configured ? new URL(configured) : window.location;
  const protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${base.host}/ws/ev?ticket=${encodeURIComponent(ticket)}`;
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

    const retry = () => {
      if (stopped) return;
      retryTimer = window.setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 15000);
    };

    const connect = async () => {
      let ticket;
      try {
        ticket = (await api.post('/api/ev/live-ticket')).data.ticket;
      } catch {
        retry();
        return;
      }
      if (stopped) return;
      socket = new WebSocket(websocketUrl(ticket));
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
        retry();
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
