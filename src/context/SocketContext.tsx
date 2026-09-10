'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io as ClientIO, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Wake up the Pages API socket endpoint
    fetch('/api/socket/io').catch(() => {});

    const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const socketInstance: Socket = ClientIO(siteUrl, {
      path: '/api/socket/io',
      addTrailingSlash: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['polling'],
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
