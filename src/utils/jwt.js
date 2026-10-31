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

function getJwtExpiresIn() {
  const expiresIn = process.env.JWT_EXPIRES_IN?.trim() || '1d';
  if (!/^[1-9]\d*[smhd]$/i.test(expiresIn)) {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableError(
        'JWT_EXPIRES_IN tidak valid. Gunakan durasi positif seperti 1d, 12h, atau 30m.',
      );
    }
    throw new Error(
      'JWT_EXPIRES_IN tidak valid. Gunakan durasi positif seperti 1d, 12h, atau 30m.',
    );
  }
  return expiresIn;
}

export function validateJwtConfiguration() {
  getJwtSecret();
  getJwtExpiresIn();
}

export function generateToken(payload, options = {}) {
  const secret = getJwtSecret();
  const expiresIn = options.expiresIn || getJwtExpiresIn();
  return jwt.sign(payload, secret, { expiresIn, ...options });
}

export function verifyToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
}
