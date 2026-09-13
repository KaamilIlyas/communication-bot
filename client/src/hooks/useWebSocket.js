import { useState, useRef, useEffect, useCallback } from 'react';

export function useWebSocket({ onMessage, url }) {
  const [status, setStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected'
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const getWsUrl = useCallback(() => {
    if (url) return url;
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If running in Vite dev mode on 5173, backend is on 3001
    const host = window.location.port === '5173' ? `${window.location.hostname}:3001` : window.location.host;
    return `${protocol}//${host}`;
  }, [url]);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      setStatus('connecting');
      setError(null);
      const wsUrl = getWsUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        setError(null);
        console.log('[WebSocket] Connected to', wsUrl);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessageRef.current) {
            onMessageRef.current(data);
          }
        } catch (e) {
          console.error('[WebSocket] Message parsing error:', e);
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        console.log('[WebSocket] Disconnected. Reconnecting in 2.5s...');
        reconnectTimeoutRef.current = setTimeout(connect, 2500);
      };

      ws.onerror = (err) => {
        console.error('[WebSocket] Connection error:', err);
        setError('Connection failed. Is the server running?');
      };
    } catch (err) {
      console.error('[WebSocket] Init error:', err);
      setStatus('disconnected');
      setError(err.message);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [getWsUrl]);

  const sendMessage = useCallback((payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (typeof payload === 'string') {
        wsRef.current.send(payload);
      } else {
        wsRef.current.send(JSON.stringify(payload));
      }
      return true;
    }
    console.warn('[WebSocket] Cannot send message, socket is not open');
    return false;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return {
    status,
    error,
    sendMessage,
    reconnect: connect
  };
}
