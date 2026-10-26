import jwt from 'jsonwebtoken';
import { ServiceUnavailableError } from './errors.js';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || (process.env.NODE_ENV === 'production' && secret.length < 32)) {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableError(
        'Autentikasi belum dikonfigurasi. Atur JWT_SECRET minimal 32 karakter pada environment backend lalu deploy ulang.',
      );
    }
    return 'dev-secret-key-suarakita-minimum-32-characters-long';
  }
  return secret;
}

export function validateJwtConfiguration() {
  getJwtSecret();
}

export function generateToken(payload, options = {}) {
  const secret = getJwtSecret();
  const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || '1d';
  return jwt.sign(payload, secret, { expiresIn, ...options });
}

export function verifyToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
}
