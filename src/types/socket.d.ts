import { Server as NetServer, Socket } from 'net';
import { NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';

export type NextApiResponseServerIo = NextApiResponse & {
  socket: Socket & {
    server: NetServer & {
      io: SocketIOServer;
    };
  };
};

export interface ChatMessage {
  id: string;
  channelId: string;
  body: string;
  spoilerLevel: string;
  createdAt: string;
  replyToId?: string | null;
  author: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  };
}
