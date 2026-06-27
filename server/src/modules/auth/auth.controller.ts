import { Request, Response } from 'express';
import * as authService from './auth.service';

// Register a new user account.
export async function register(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  const result = await authService.register(email, password);
  res.status(201).json(result);
}

// Authenticate an existing user and return access and refresh tokens.
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  const result = await authService.login(email, password);
  res.json(result);
}

// Exchange a valid refresh token for a new access token pair.
export async function refreshTokenHandler(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;

  const result = await authService.refreshAccessToken(refreshToken);
  res.json(result);
}

// Return the authenticated user's profile data.
export async function me(req: Request, res: Response): Promise<void> {
  const { userId } = req.user;

  const result = await authService.me(userId);
  res.json(result);
}

// Send a password reset email when requested.
export async function forgotPasswordHandler(req: Request, res: Response): Promise<void> {
  const { email } = req.body;

  await authService.forgotPassword(email);
  res.json({ message: 'If that email is registered, a reset link has been sent' });
}

// Reset a password using a valid reset token.
export async function resetPasswordHandler(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body;

  await authService.resetPassword(token, newPassword);
  res.json({ message: 'Password reset successful' });
}

// Send a verification OTP to the provided email.
export async function sendOTPHandler(req: Request, res: Response): Promise<void> {
  const { email } = req.body;

  await authService.sendEmailOTP(email);
  res.json({ message: 'Verification code sent' });
}

// Verify an email OTP and complete account verification.
export async function verifyEmailHandler(req: Request, res: Response): Promise<void> {
  const { email, otp } = req.body;

  const result = await authService.verifyEmailOTP(email, otp);
  res.json(result);
}

// Check whether a requested username is available.
export async function checkUsernameHandler(req: Request, res: Response): Promise<void> {
  const username = req.query.username as string;

  if (!username || username.trim().length < 1) {
    res.status(400).json({ error: 'username query param is required' });
    return;
  }

  const result = await authService.checkUsername(username);
  res.json(result);
}

// Check whether a provided email domain is recognized.
export async function checkDomainHandler(req: Request, res: Response): Promise<void> {
  const email = req.query.email as string;

  if (!email) {
    res.status(400).json({ error: 'email query param is required' });
    return;
  }

  const result = await authService.checkDomain(email);
  res.json(result);
}
