import { userRepository } from '../repositories/userRepository.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { verifyToken } from '../utils/jwt.js';

export async function authenticate(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Akses ditolak. Token otorisasi tidak ditemukan.'));
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Sesi telah berakhir. Silakan login kembali.'));
    }
    return next(new UnauthorizedError('Token tidak valid atau kedaluwarsa.'));
  }

  try {
    const user = await userRepository.findById(decoded.id);
    if (!user) {
      return next(new UnauthorizedError('Pengguna tidak ditemukan atau sesi tidak valid.'));
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuthenticate(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    req.user = null;
    return next();
  }

  try {
    const user = await userRepository.findById(decoded.id);
    req.user = user || null;
  } catch (error) {
    return next(error);
  }
  next();
}

export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Akses ditolak. Anda harus login terlebih dahulu.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError('Anda tidak memiliki izin yang cukup untuk mengakses sumber daya ini.'),
      );
    }

    next();
  };
}
