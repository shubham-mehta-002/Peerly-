import nodemailer from 'nodemailer';
import { config } from '../config';
import { AppError } from '../shared/errors';
import { logger } from '../shared/logger';

// Port 465 + secure:true uses direct TLS (no STARTTLS handshake).
// Port 587 + secure:false relies on STARTTLS, which is frequently blocked
// on cloud platforms like Render, causing connection timeouts.
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: config.GMAIL_USER,
    pass: config.GMAIL_APP_PASSWORD,
  },
});

// Verify SMTP connection on startup and crash loudly if it fails.
// A broken mail config should surface at boot, not silently at runtime
// when a real user tries to reset their password.
export async function verifyEmailService(): Promise<void> {
  try {
    await transporter.verify();
    logger.info('SMTP connection verified — mail service ready');
  } catch (err: any) {
    logger.error('SMTP connection failed — check GMAIL_USER and GMAIL_APP_PASSWORD', {
      message: err.message,
      code: err.code,
    });
    throw err; // let the caller (server startup) decide whether to abort
  }
}

/** Escape a string for safe use inside HTML. */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  try {
    const info = await transporter.sendMail({
      from: `"Peerly" <${config.GMAIL_USER}>`,
      to,
      subject: 'Reset your Peerly password',
      html: `
        <p>You requested a password reset for your Peerly account.</p>
        <p><a href="${escapeHtml(resetLink)}">Click here to reset your password</a></p>
        <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
      `,
    });
    logger.info('Password reset email sent', { to, messageId: info.messageId, response: info.response });
  } catch (err: any) {
    logger.error('Failed to send password reset email', { to, message: err?.message, code: err?.code, response: err?.response });
    throw new AppError(503, 'Email delivery failed. Please try again later.');
  }
}

export async function sendOTPEmail(to: string, otp: string): Promise<void> {
  try {
    const info = await transporter.sendMail({
      from: `"Peerly" <${config.GMAIL_USER}>`,
      to,
      subject: 'Verify your Peerly email',
      html: `
        <p>Your Peerly verification code is:</p>
        <h2>${escapeHtml(otp)}</h2>
        <p>This code expires in 15 minutes.</p>
      `,
    });
    logger.info('OTP email sent', { to, messageId: info.messageId, response: info.response });
  } catch (err: any) {
    logger.error('Failed to send OTP email', { to, message: err?.message, code: err?.code, response: err?.response });
    throw new AppError(503, 'Failed to send verification email. Please try again later.');
  }
}
