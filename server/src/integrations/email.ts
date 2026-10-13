import nodemailer from 'nodemailer';
import { config } from '../config';
import { AppError } from '../shared/errors';
import { logger } from '../shared/logger';

// Brevo SMTP relay — works on Render (routes over standard web infrastructure,
// unlike smtp.gmail.com which Render blocks on ports 465/587).
// The `from` address must be a verified sender in Brevo dashboard.
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 465,
  secure: true,
  auth: {
    user: config.BREVO_SMTP_USER,
    pass: config.BREVO_SMTP_KEY,
  },
});

// Verify SMTP connection on startup — logs a warning but does NOT
// crash the server. Keeps the service up even if mail is misconfigured.
export async function verifyEmailService(): Promise<void> {
  try {
    await transporter.verify();
    logger.info('SMTP connection verified — mail service ready');
  } catch (err: any) {
    logger.warn('SMTP connection failed — email sending will not work. Check BREVO_SMTP_USER and BREVO_SMTP_KEY', {
      message: err.message,
      code: err.code,
    });
    // intentionally not throwing — let the server start
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

// SENDER_EMAIL must be a verified sender in Brevo (Senders, domains & IPs → Senders).
const SENDER_EMAIL = config.GMAIL_USER;

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  try {
    const info = await transporter.sendMail({
      from: `"Peerly" <${SENDER_EMAIL}>`,
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
      from: `"Peerly" <${SENDER_EMAIL}>`,
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
