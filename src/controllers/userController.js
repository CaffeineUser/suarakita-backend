import { userService } from '../services/userService.js';

export const userController = {
  async getMe(req, res, next) {
    try {
      const user = await userService.getProfile(req.user.id);
      res.status(200).json({ data: user });
    } catch (error) {
      next(error);
    }
  },

  async updateMe(req, res, next) {
    try {
      const updatedUser = await userService.updateProfile(req.user.id, req.body);
      res.status(200).json({ data: updatedUser });
    } catch (error) {
      next(error);
    }
  },

  async getAllUsers(req, res, next) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await userService.getAllUsers({ page, limit });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
