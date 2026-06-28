import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JWTPayload {
    userId: string;
    email: string;
    isAdmin: boolean;
    campusId: string | null;
}

interface RefreshTokenPayload extends JWTPayload {
    type: 'refresh';
}

const accessSecret = config.JWT_SECRET;
const refreshSecret = config.JWT_REFRESH_SECRET || config.JWT_SECRET;

export function signAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, accessSecret, {
        expiresIn: config.JWT_ACCESS_EXPIRES_IN,
    } as jwt.SignOptions);
}


export function signRefreshToken(payload: JWTPayload): string {
    return jwt.sign({ ...payload, type: 'refresh' } as RefreshTokenPayload, refreshSecret, {
        expiresIn: config.JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions);
}

export function signToken(payload: JWTPayload): string {
    return signAccessToken(payload);
}

export function verifyAccessToken(token: string): JWTPayload {
    return jwt.verify(token, accessSecret) as JWTPayload;
}

export function verifyRefreshToken(token: string): JWTPayload {
    const payload = jwt.verify(token, refreshSecret) as RefreshTokenPayload;

    if (payload.type !== 'refresh') {
        throw new Error('Invalid refresh token');
    }

    return payload;
}

export function verifyToken(token: string): JWTPayload {
    return verifyAccessToken(token);
}
