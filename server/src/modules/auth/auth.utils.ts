import crypto from 'crypto';
import { config } from '../../config';
import { AppError } from '../../lib/errors';
import { JWTPayload, signAccessToken } from '../../lib/jwt';
import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabase';

export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export function getRefreshTokenExpiry(): Date {
    const value = config.JWT_REFRESH_EXPIRES_IN;
    const match = value.match(/^(\d+)([smhd])$/i);

    if (!match) {
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers: Record<string, number> = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };                        

    return new Date(Date.now() + amount * multipliers[unit]);
}

export async function storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    const expiresAt = getRefreshTokenExpiry().toISOString();

    const { error } = await supabase.from('refresh_tokens').insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
    });

    if (error) {
        logger.error('Refresh token insert failed', { userId, message: error.message });
        throw new AppError(503, 'Authentication service temporarily unavailable. Please try again.');
    }
}

export function buildAuthResponse(
    payload: JWTPayload,
    profile: { onboarding_completed?: boolean | null } | null | undefined,
    refreshToken: string,
    ) {
    const accessToken = signAccessToken(payload);

    return {
        token: accessToken,
        accessToken,
        refreshToken,
        onboarding_completed: profile?.onboarding_completed ?? false,
    };
}

export function extractDomain(email: string): string {
    return email.split('@')[1]?.toLowerCase();
}

export async function validateDomain(domain: string): Promise<{ collegeId: string }> {
    const { data: domainRow } = await supabase
        .from('college_domains')
        .select('id, college_id, is_active, colleges(is_active)')
        .eq('domain', domain)
        .single();

    if (!domainRow) throw new AppError(403, 'Domain not recognized');
    if (!domainRow.is_active) throw new AppError(403, 'Your institution is not currently active');

    const college = (domainRow.colleges as any) as { is_active: boolean } | null;
    if (!college?.is_active) throw new AppError(403, 'Your institution is not currently active');

    const { data: campus } = await supabase
        .from('campuses')
        .select('id')
        .eq('college_id', domainRow.college_id)
        .eq('is_active', true)
        .limit(1)
        .single();

    if (!campus) throw new AppError(403, 'No active campus available for your institution');

    return { collegeId: domainRow.college_id };
}


