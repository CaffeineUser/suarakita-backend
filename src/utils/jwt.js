import jwt from 'jsonwebtoken';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET wajib dikonfigurasi di lingkungan produksi.');
    }
    return 'dev-secret-key-suarakita-minimum-32-characters-long';
  }
  return secret;
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
