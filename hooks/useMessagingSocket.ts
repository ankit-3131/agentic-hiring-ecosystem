import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from '../lib/apiConfig';
import type { ChatMessage } from '../lib/chatTypes';

type Opts = {
  userId: string;
  applicationId: string | null;
  enabled?: boolean;
  onMessage: (msg: ChatMessage) => void;
};

export function useMessagingSocket({ userId, applicationId, enabled = true, onMessage }: Opts) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const prevThreadRef = useRef<string | null>(null);
  const appIdRef = useRef(applicationId);
  appIdRef.current = applicationId;

  useEffect(() => {
    if (!enabled || !userId) {
      setConnected(false);
      return;
    }
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const handleConnect = () => {
      setConnected(true);
      socket.emit('join_user', { user_id: userId });
      const aid = appIdRef.current;
      if (aid) {
        socket.emit('join_thread', { application_id: aid });
      }
    };
    const handleDisconnect = () => setConnected(false);
    const handleMessage = (payload: ChatMessage) => {
      onMessageRef.current(payload);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('message:new', handleMessage);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('message:new', handleMessage);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [userId, enabled]);

  useEffect(() => {
    const socket = socketRef.current;
    const prev = prevThreadRef.current;
    const cur = applicationId || null;
    if (prev === cur) return;
    if (!socket?.connected) {
      prevThreadRef.current = cur;
      return;
    }
    if (prev) {
      socket.emit('leave_thread', { application_id: prev });
    }
    if (cur) {
      socket.emit('join_thread', { application_id: cur });
    }
    prevThreadRef.current = cur;
  }, [applicationId]);

  return { connected };
}
