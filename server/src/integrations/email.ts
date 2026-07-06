import nodemailer from 'nodemailer';
import { config } from '../config';
import { AppError } from '../shared/errors';
import { logger } from '../shared/logger';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: config.GMAIL_USER,
    pass: config.GMAIL_APP_PASSWORD,
  },
});

// Verify SMTP connection on startup
transporter.verify((err) => {
  if (err) {
    logger.error('SMTP connection failed', { message: err.message });
  } else {
    logger.info('SMTP connection verified — mail service ready');
  }
});

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  try {
    const info = await transporter.sendMail({
      from: `"Peerly" <${config.GMAIL_USER}>`,
      to,
      subject: 'Reset your Peerly password',
      html: `
        <p>You requested a password reset for your Peerly account.</p>
        <p><a href="${resetLink}">Click here to reset your password</a></p>
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
        <h2>${otp}</h2>
        <p>This code expires in 15 minutes.</p>
      `,
    });
    logger.info('OTP email sent', { to, messageId: info.messageId, response: info.response });
  } catch (err: any) {
    logger.error('Failed to send OTP email', { to, message: err?.message, code: err?.code, response: err?.response });
    throw new AppError(503, 'Failed to send verification email. Please try again later.');
  }
}
