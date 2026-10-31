import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/userRepository.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export const userService = {
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('Pengguna tidak ditemukan.');
    }
    return user;
  },

  async updateProfile(userId, { name, current_password, new_password }) {
    const profile = await userRepository.findById(userId);
    if (!profile) {
      throw new NotFoundError('Pengguna tidak ditemukan.');
    }

    const user = await userRepository.findByEmail(profile.email);
    if (!user) {
      throw new NotFoundError('Pengguna tidak ditemukan.');
    }

    let passwordHash;
    if (new_password) {
      if (!current_password) {
        throw new BadRequestError('Kata sandi saat ini wajib diisi untuk mengubah kata sandi.');
      }
      const isMatch = await bcrypt.compare(current_password, user.password_hash);
      if (!isMatch) {
        throw new BadRequestError('Kata sandi saat ini tidak sesuai.');
      }
      passwordHash = await bcrypt.hash(new_password, 10);
    }

    return userRepository.updateProfile(userId, {
      name,
      passwordHash,
    });
  },

  async getAllUsers({ page = 1, limit = 20 } = {}) {
    const offset = Math.max(0, (page - 1) * limit);
    const [users, total] = await Promise.all([
      userRepository.findAll({ limit, offset }),
      userRepository.countAll(),
    ]);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    };
  },
};
