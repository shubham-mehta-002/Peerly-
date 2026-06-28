import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../lib/jwt';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { AppError } from '../lib/errors';

declare global {
  namespace Express {
    interface Request {
      user: JWTPayload & {
        onboardingCompleted: boolean;
      };
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyToken(token);

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('onboarding_completed, campus_id')
      .eq('id', payload.userId)
      .single();

    if (error) {
      logger.warn('Profile fetch failed in authenticate middleware', {
        userId: payload.userId,
        error: error.message,
      });
      throw new AppError(401,"Invalid or expired token")
      return;
    }

    req.user = {
      ...payload,
      campusId: profile?.campus_id ?? null,
      onboardingCompleted: profile?.onboarding_completed ?? false,
    };

    next();
  } catch (err) {
    logger.debug('Token verification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new AppError(401,"Invalid or expired token")
  }
}
