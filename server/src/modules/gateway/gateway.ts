import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { config } from '../../config';
import { logger } from '../../shared/logger';
import { gatewayAuth } from './gateway.auth';
import { registerHandlers } from './gateway.handlers';
import { setCommunityNs } from '../../shared/gateway-singleton';

export function createGateway(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: config.FRONTEND_URL, credentials: true },
  });

  const communityNamespace = io.of('/communities');
  setCommunityNs(communityNamespace);
  communityNamespace.use(gatewayAuth);

  communityNamespace.on('connection', (socket) => {
    logger.info('Socket connected', { userId: socket.data.user.userId });
    registerHandlers(socket, communityNamespace);

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { userId: socket.data.user.userId });
    });
  });

  return io;
}
