import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../../config';
import { sendOTPEmail, sendPasswordResetEmail } from '../../integrations/email';
import { AppError } from '../../shared/errors';
import { JWTPayload, signRefreshToken, verifyRefreshToken } from '../../integrations/jwt';
import { logger } from '../../shared/logger';
import redis from '../../integrations/redis';
import { supabase } from '../../integrations/supabase';
import {
  buildAuthResponse,
  extractDomain,
  hashToken,
  storeRefreshToken,
  validateDomain,
} from './auth.utils';

// Register a new user and send a verification OTP.
export async function register(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const domain = extractDomain(normalizedEmail);
  await validateDomain(domain);

  const { data: existing } = await supabase
    .from('users')
    .select('id, is_email_verified')
    .eq('email', normalizedEmail)
    .single();

  if (existing) {
    if (existing.is_email_verified) throw new AppError(409, 'Email already registered');

    // Re-send OTP for an unverified existing user.
    await sendEmailOTP(normalizedEmail);
    return { email: normalizedEmail, pending_verification: true };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { data: user, error } = await supabase
    .from('users')
    .insert({ email: normalizedEmail, password_hash: passwordHash })
    .select('id, email, is_admin')
    .single();

  if (error || !user) {
    logger.error('Failed to insert user during register', { error: error?.message });
    throw new AppError(500, 'Failed to create user');
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: user.id });

  if (profileError) {
    logger.error('Failed to insert profile after user create', {
      userId: user.id,
      error: profileError.message,
    });
    throw new AppError(500, 'Failed to create user profile');
  }

  logger.info('User registered, sending OTP', { userId: user.id, domain });

  await sendEmailOTP(normalizedEmail);

  return { email: normalizedEmail, pending_verification: true };
}

// Authenticate a user and return a signed JWT.
export async function login(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const { data: user } = await supabase
    .from('users')
    .select('id, email, password_hash, is_admin, is_email_verified')
    .eq('email', normalizedEmail)
    .single();

  if (!user) throw new AppError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  if (!user.is_email_verified) {
    throw new AppError(403, 'Please verify your email before logging in');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('campus_id, onboarding_completed')
    .eq('id', user.id)
    .single();

  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    isAdmin: user.is_admin,
    campusId: profile?.campus_id ?? null,
  };
  const refreshToken = signRefreshToken(payload);

  await storeRefreshToken(user.id, refreshToken);

  logger.info('User logged in', { userId: user.id });

  return buildAuthResponse(payload, profile, refreshToken);
}

// Return the currently authenticated user's profile data.
export async function me(userId: string) {
  const { data: user } = await supabase
    .from('users')
    .select('id, email, is_admin, created_at')
    .eq('id', userId)
    .single();

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, username, bio, campus_id, onboarding_completed, avatar_url, updated_at')
    .eq('id', userId)
    .single();

  return {
    ...user,
    profile,
  };
}

// Send a password reset email for an existing account.
// Flow: normalize the email, find the user, create a short-lived reset token in Redis, and email the reset link.
export async function forgotPassword(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .single();

  if (!user) return;

  const plain = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(plain).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const payload = JSON.stringify({ userId: user.id, expiresAt });

  try {
    await redis.set(`password_reset:${tokenHash}`, payload, 'EX', 60 * 60);
  } catch (err: any) {
    logger.error('Redis password reset store failed', { userId: user.id, message: err?.message });
    throw new AppError(503, 'Password reset service temporarily unavailable. Please try again.');
  }

  const resetLink = `${config.FRONTEND_URL}/auth/reset-password?token=${plain}`;
  await sendPasswordResetEmail(normalizedEmail, resetLink);
  logger.info('Password reset email sent', { userId: user.id });
}

// Reset a password using a valid token.
// Flow: hash the supplied token, look up the matching reset record in Redis, verify that it is still valid,
// update the password, and consume the token so it cannot be reused.
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const redisKey = `password_reset:${tokenHash}`;

  let record: string | null;
  try {
    record = await redis.get(redisKey);
  } catch (err: any) {
    logger.error('Redis password reset lookup failed', { message: err?.message });
    throw new AppError(503, 'Password reset service temporarily unavailable. Please try again.');
  }

  if (!record) throw new AppError(400, 'Invalid or expired reset token');

  const { userId, expiresAt } = JSON.parse(record) as { userId: string; expiresAt: string };
  if (new Date(expiresAt) < new Date()) {
    await redis.del(redisKey);
    throw new AppError(400, 'Reset token expired');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await supabase
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('id', userId);

  await redis.del(redisKey);

  logger.info('Password reset successful', { userId });
}

// Send a one-time password email for account verification.
export async function sendEmailOTP(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  const { data: user } = await supabase
    .from('users')
    .select('id, is_email_verified')
    .eq('email', normalizedEmail)
    .single();

  if (!user) throw new AppError(404, 'User not found');
  if (user.is_email_verified) throw new AppError(409, 'Email already verified');

  const plain = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = crypto.createHash('sha256').update(plain).digest('hex');

  try {
    await redis.set(`otp:${user.id}`, JSON.stringify({ hash: otpHash }), 'EX', 900);
  } catch (err: any) {
    logger.error('Redis OTP store failed', { userId: user.id, message: err?.message });
    throw new AppError(503, 'OTP service temporarily unavailable. Please try again.');
  }

  await sendOTPEmail(normalizedEmail, plain);
  logger.info('OTP sent via Redis', { userId: user.id });
}


// Verify an OTP and complete email verification.
export async function verifyEmailOTP(email: string, otp: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

  const { data: user } = await supabase
    .from('users')
    .select('id, is_email_verified, is_admin')
    .eq('email', normalizedEmail)
    .single();

  if (!user) throw new AppError(404, 'User not found');
  if (user.is_email_verified) throw new AppError(409, 'Email already verified');

  const stored = await redis.get(`otp:${user.id}`);
  if (!stored) throw new AppError(400, 'OTP expired or not found');

  const { hash } = JSON.parse(stored) as { hash: string };
  if (hash !== otpHash) throw new AppError(400, 'Invalid OTP');

  await redis.del(`otp:${user.id}`);

  await supabase
    .from('users')
    .update({ is_email_verified: true })
    .eq('id', user.id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('campus_id, onboarding_completed')
    .eq('id', user.id)
    .single();

  const payload: JWTPayload = {
    userId: user.id,
    email: normalizedEmail,
    isAdmin: user.is_admin,
    campusId: profile?.campus_id ?? null,
  };
  const refreshToken = signRefreshToken(payload);

  await storeRefreshToken(user.id, refreshToken);

  logger.info('Email verified', { userId: user.id });

  return buildAuthResponse(payload, profile, refreshToken);
}

export async function checkDomain(email: string) {
    const domain = extractDomain(email.toLowerCase().trim());
    if (!domain) return { status: 'invalid' as const, domain: '' };

    const { data: domainRow } = await supabase
        .from('college_domains')
        .select('id, is_active, college_id, colleges(name, is_active)')
        .eq('domain', domain)
        .single();

    if (!domainRow) return { status: 'not_found' as const, domain };

    const college = domainRow.colleges as any;
    if (!domainRow.is_active || !college?.is_active) {
        return { status: 'inactive' as const, domain, college_name: college?.name ?? null };
    }

    return { status: 'active' as const, domain, college_name: college?.name ?? null };
}

export async function refreshAccessToken(refreshToken: string) {
  let payload: JWTPayload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'Invalid refresh token');
  }

  const tokenHash = hashToken(refreshToken);
  const { data: storedToken, error: lookupError } = await supabase
    .from('refresh_tokens')
    .select('id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (lookupError) {
    logger.error('Refresh token lookup failed', { userId: payload.userId, message: lookupError.message });
    throw new AppError(503, 'Authentication service temporarily unavailable. Please try again.');
  }

  if (!storedToken) {
    throw new AppError(401, 'Invalid refresh token');
  }

  if (storedToken.revoked_at || new Date(storedToken.expires_at) < new Date()) {
    await supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', storedToken.id);
    throw new AppError(401, 'Invalid refresh token');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('campus_id, onboarding_completed')
    .eq('id', payload.userId)
    .single();

  const newPayload: JWTPayload = {
    ...payload,
    campusId: profile?.campus_id ?? null,
  };
  const newRefreshToken = signRefreshToken(newPayload);

  await supabase
    .from('refresh_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', storedToken.id);

  await storeRefreshToken(payload.userId, newRefreshToken);

  return buildAuthResponse(newPayload, profile, newRefreshToken);
}

// Check whether a requested username is already taken.
export async function checkUsername(username: string): Promise<{ available: boolean }> {
  const normalized = username.toLowerCase().trim();
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', normalized)
    .single();

  return { available: !data };
}
