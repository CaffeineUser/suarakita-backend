import { supportService } from '../services/supportService.js';

export const supportController = {
  async addSupport(req, res, next) {
    try {
      const result = await supportService.addSupport(Number(req.params.id), req.user.id);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },

  async removeSupport(req, res, next) {
    try {
      const result = await supportService.removeSupport(Number(req.params.id), req.user.id);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  },

  async getSupports(req, res, next) {
    try {
      const result = await supportService.getSupports(Number(req.params.id));
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
};
