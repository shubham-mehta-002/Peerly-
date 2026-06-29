import type { Socket, Namespace } from 'socket.io';
import { getMemberRole } from '../communities/communities.service';
import { saveMessage } from '../communities/communities.service';
import { logger } from '../../shared/logger';

function getCommunityId(payload: unknown): string | null {
  const communityId = (payload as Record<string, unknown> | undefined)?.communityId;
  return typeof communityId === 'string' && communityId.trim() ? communityId : null;
}

function emitError(socket: Socket, message: string): void {
  socket.emit('error', { message });
}

function isValidMessagePayload(payload: unknown): payload is { communityId: string; content: string; image_url?: string | null } {
  const record = payload as Record<string, unknown> | undefined;
  return !!record
    && typeof record.communityId === 'string'
    && record.communityId.trim() !== ''
    && typeof record.content === 'string'
    && record.content.trim() !== '';
}

export function registerHandlers(socket: Socket, ns: Namespace): void {

  socket.on('join_room', async (payload: unknown) => {
    const communityId = getCommunityId(payload);
    if (!communityId) {
      emitError(socket, 'communityId is required');
      return;
    }

    try {
      const role = await getMemberRole(communityId, socket.data.user.userId);
      if (!role) {
        emitError(socket, 'Not a member');
        return;
      }
      socket.join(communityId);
    } catch (err) {
      logger.error('join_room error', { error: err });
      emitError(socket, 'Failed to join room');
    }
  });

  socket.on('leave_room', (payload: unknown) => {
    const communityId = getCommunityId(payload);
    if (!communityId) return;
    socket.leave(communityId);
  });

  socket.on('send_message', async (payload: unknown) => {
    try {
      if (!isValidMessagePayload(payload)) {
        emitError(socket, 'Invalid payload');
        return;
      }

      const { communityId, content, image_url } = payload;
      const role = await getMemberRole(communityId, socket.data.user.userId);
      if (!role) {
        emitError(socket, 'Not a member');
        return;
      }

      // Persist the message to DB
      const saved = await saveMessage({
        communityId,
        senderId: socket.data.user.userId,
        content: content.trim(),
        imageUrl: image_url ?? null,
      });

      ns.to(communityId).emit('new_message', {
        id: saved.id,
        community_id: communityId,
        content: saved.content,
        image_url: saved.image_url,
        sender: {
          username: socket.data.user.username,
          avatar_url: saved.sender_avatar_url,
        },
        created_at: saved.created_at,
        is_system: false,
      });
    } catch (err) {
      logger.error('send_message error', { error: err });
      emitError(socket, 'Failed to send message');
    }
  });

  socket.on('typing', (payload: unknown) => {
    const communityId = getCommunityId(payload);
    if (!communityId) return;

    socket.to(communityId).emit('typing_indicator', {
      communityId,
      username: socket.data.user.username,
    });
  });
}
