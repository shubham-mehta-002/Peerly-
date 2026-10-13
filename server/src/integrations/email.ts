import { BrevoClient } from '@getbrevo/brevo';
import { config } from '../config';
import { AppError } from '../shared/errors';
import { logger } from '../shared/logger';

// Brevo HTTP API — uses port 443 (HTTPS), never blocked by Render or any
// cloud platform. No SMTP ports needed.
const brevo = new BrevoClient({ apiKey: config.BREVO_API_KEY });

/** Escape a string for safe use inside HTML. */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Verify API key is valid at startup — non-fatal, just logs.
export async function verifyEmailService(): Promise<void> {
  try {
    await brevo.account.getAccount();
    logger.info('Brevo API connection verified — mail service ready');
  } catch (err: any) {
    logger.warn('Brevo API connection failed — email sending will not work. Check BREVO_API_KEY', {
      message: err.message,
      code: err.code,
    });
    // intentionally not throwing — let the server start
  }
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  try {
    const response = await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: 'Peerly', email: config.GMAIL_USER },
      to: [{ email: to }],
      subject: 'Reset your Peerly password',
      htmlContent: `
        <p>You requested a password reset for your Peerly account.</p>
        <p><a href="${escapeHtml(resetLink)}">Click here to reset your password</a></p>
        <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
      `,
    });
    logger.info('Password reset email sent', { to, messageId: (response as any)?.messageId ?? (response as any)?.body?.messageId });
  } catch (err: any) {
    logger.error('Failed to send password reset email', { to, message: err?.message, code: err?.code });
    throw new AppError(503, 'Email delivery failed. Please try again later.');
  }
}

export async function sendOTPEmail(to: string, otp: string): Promise<void> {
  try {
    const response = await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: 'Peerly', email: config.GMAIL_USER },
      to: [{ email: to }],
      subject: 'Verify your Peerly email',
      htmlContent: `
        <p>Your Peerly verification code is:</p>
        <h2>${escapeHtml(otp)}</h2>
        <p>This code expires in 15 minutes.</p>
      `,
    });
    logger.info('OTP email sent', { to, messageId: (response as any)?.messageId ?? (response as any)?.body?.messageId });
  } catch (err: any) {
    logger.error('Failed to send OTP email', { to, message: err?.message, code: err?.code });
    throw new AppError(503, 'Failed to send verification email. Please try again later.');
  }
}
