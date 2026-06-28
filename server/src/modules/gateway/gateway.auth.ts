import type { Socket } from 'socket.io';
import { verifyToken } from '../../integrations/jwt';
import { supabase } from '../../integrations/supabase';
import { logger } from '../../shared/logger';

export async function gatewayAuth(socket: Socket, next: (err?: Error) => void): Promise<void> {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token.trim()) {
      next(new Error('Unauthorized'));
      return;
    }

    const payload = verifyToken(token);

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username, campus_id')
      .eq('id', payload.userId)
      .single();

    if (error || !profile) {
      next(new Error('Unauthorized'));
      return;
    }

    socket.data.user = {
      userId: profile.id as string,
      campusId: profile.campus_id as string,
      isAdmin: payload.isAdmin,
      username: profile.username as string,
    };

    next();
  } catch (err) {
    logger.debug('Gateway auth failed', { error: err instanceof Error ? err.message : String(err) });
    next(new Error('Unauthorized'));
  }
}
