import { dashboardRepository } from '../repositories/dashboardRepository.js';

export const dashboardService = {
  async getSummary() {
    return dashboardRepository.getSummary();
  },

  async getByCategory() {
    return dashboardRepository.getByCategory();
  },

  async getByStatus() {
    return dashboardRepository.getByStatus();
  },

  async getPriorityReports(limit = 5) {
    return dashboardRepository.getPriorityReports(limit);
  },
};
