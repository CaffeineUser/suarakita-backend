import { dashboardService } from '../services/dashboardService.js';

export const dashboardController = {
  async getSummary(_req, res, next) {
    try {
      const summary = await dashboardService.getSummary();
      res.status(200).json({ data: summary });
    } catch (error) {
      next(error);
    }
  },

  async getByCategory(_req, res, next) {
    try {
      const data = await dashboardService.getByCategory();
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  },

  async getByStatus(_req, res, next) {
    try {
      const data = await dashboardService.getByStatus();
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  },

  async getPriorityReports(req, res, next) {
    try {
      const limit = Number(req.query.limit) || 5;
      const data = await dashboardService.getPriorityReports(limit);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  },
};
