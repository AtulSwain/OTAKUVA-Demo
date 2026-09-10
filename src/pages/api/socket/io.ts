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
