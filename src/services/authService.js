import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/userRepository.js';
import { ConflictError, NotFoundError, UnauthorizedError } from '../utils/errors.js';
import { generateToken, validateJwtConfiguration } from '../utils/jwt.js';

export const authService = {
  async register({ name, email, password }) {
    validateJwtConfiguration();

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('Email sudah terdaftar. Silakan gunakan email lain atau login.');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = await userRepository.create({
      name,
      email,
      passwordHash,
      role: 'warga',
    });

    const token = generateToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    return {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        created_at: newUser.created_at,
        updated_at: newUser.updated_at,
      },
      token,
    };
  },

  async login({ email, password }) {
    validateJwtConfiguration();

    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Email atau kata sandi tidak valid.');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedError('Email atau kata sandi tidak valid.');
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      token,
    };
  },

  async getMe(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('Pengguna tidak ditemukan.');
    }
    return user;
  },
};
