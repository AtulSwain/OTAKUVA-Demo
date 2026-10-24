import { Server as NetServer } from 'http';
import { NextApiRequest } from 'next';
import { Server as ServerIO } from 'socket.io';
import { NextApiResponseServerIo } from '../../../types/socket';

export const config = {
  api: {
    bodyParser: false,
  },
};

const ioHandler = (req: NextApiRequest, res: NextApiResponseServerIo) => {
  if (!res.socket.server.io) {
    const path = '/api/socket/io';
    const httpServer: NetServer = res.socket.server as any;
    const io = new ServerIO(httpServer, {
      path,
      addTrailingSlash: false,
      transports: ['polling'],
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    // Make IO accessible globally across Next.js runtime
    (global as any).socketio = io;
    res.socket.server.io = io;

    io.on('connection', (socket) => {
      // Channel subscription
      socket.on('join_channel', (channelId: string) => {
        if (channelId) {
          socket.join(`channel:${channelId}`);
        }
      });

      socket.on('leave_channel', (channelId: string) => {
        if (channelId) {
          socket.leave(`channel:${channelId}`);
        }
      });

      // DM / anime-room conversation subscription (OTAKUVA Chat)
      const broadcastConversationMemberCount = (conversationId: string) => {
        const count = io.sockets.adapter.rooms.get(`conversation:${conversationId}`)?.size || 0;
        io.to(`conversation:${conversationId}`).emit('conversation_member_count', { conversationId, count });
      };

      socket.on('join_conversation', (conversationId: string) => {
        if (conversationId) {
          socket.join(`conversation:${conversationId}`);
          broadcastConversationMemberCount(conversationId);
        }
      });

      socket.on('leave_conversation', (conversationId: string) => {
        if (conversationId) {
          socket.leave(`conversation:${conversationId}`);
          broadcastConversationMemberCount(conversationId);
        }
      });

      // Update live member counts for any conversation rooms this socket
      // was in once it actually disconnects (tab close, network drop) —
      // socket.io removes it from the room automatically, but nothing else
      // recomputes the count unless we do it here, before "rooms" clears.
      socket.on('disconnecting', () => {
        for (const room of socket.rooms) {
          if (room.startsWith('conversation:')) {
            const conversationId = room.slice('conversation:'.length);
            setImmediate(() => broadcastConversationMemberCount(conversationId));
          }
        }
      });

      socket.on('conversation_typing_start', ({ conversationId, username }: { conversationId: string; username: string }) => {
        if (conversationId && username) {
          socket.to(`conversation:${conversationId}`).emit('conversation_user_typing', { conversationId, username });
        }
      });

      socket.on('conversation_typing_stop', ({ conversationId, username }: { conversationId: string; username: string }) => {
        if (conversationId && username) {
          socket.to(`conversation:${conversationId}`).emit('conversation_user_stop_typing', { conversationId, username });
        }
      });

      // Community room subscription
      socket.on('join_community', (communityId: string) => {
        if (communityId) {
          socket.join(`community:${communityId}`);
        }
      });

      socket.on('leave_community', (communityId: string) => {
        if (communityId) {
          socket.leave(`community:${communityId}`);
        }
      });

      // Real-time typing indicators
      socket.on('typing_start', ({ channelId, username }: { channelId: string; username: string }) => {
        if (channelId && username) {
          socket.to(`channel:${channelId}`).emit('user_typing', { channelId, username });
        }
      });

      socket.on('typing_stop', ({ channelId, username }: { channelId: string; username: string }) => {
        if (channelId && username) {
          socket.to(`channel:${channelId}`).emit('user_stop_typing', { channelId, username });
        }
      });

      // Client-emitted message broadcast
      socket.on('send_message', (msg: any) => {
        if (msg && msg.channelId) {
          io.to(`channel:${msg.channelId}`).emit('new_message', msg);
        }
      });
    });
  }

  res.end();
};

export default ioHandler;
