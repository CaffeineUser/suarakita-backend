import { authService } from '../services/authService.js';

export const authController = {
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  },

  async logout(_req, res, next) {
    try {
      res.status(200).json({
        data: {
          message: 'Berhasil keluar (logout).',
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getMe(req, res, next) {
    try {
      const user = await authService.getMe(req.user.id);
      res.status(200).json({ data: { user } });
    } catch (error) {
      next(error);
    }
  },
};
