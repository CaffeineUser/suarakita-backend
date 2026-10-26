import { reportService } from '../services/reportService.js';

export const reportController = {
  async getReports(req, res, next) {
    try {
      const currentUserId = req.user?.id || null;
      const { q, category_id, status, urgency, sort, order, page, limit } = req.query;

      const result = await reportService.getReports(
        {
          q,
          categoryId: category_id,
          status,
          urgency,
          sort,
          order,
          page,
          limit,
        },
        currentUserId,
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getReportById(req, res, next) {
    try {
      const currentUserId = req.user?.id || null;
      const report = await reportService.getReportById(Number(req.params.id), currentUserId);
      res.status(200).json({ data: report });
    } catch (error) {
      next(error);
    }
  },

  async createReport(req, res, next) {
    try {
      const report = await reportService.createReport({
        userId: req.user.id,
        categoryId: req.body.category_id,
        title: req.body.title,
        description: req.body.description,
        locationName: req.body.location_name,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        urgency: req.body.urgency,
        photoFile: req.file,
      });

      res.status(201).json({ data: report });
    } catch (error) {
      next(error);
    }
  },

  async updateReport(req, res, next) {
    try {
      const report = await reportService.updateReport(
        Number(req.params.id),
        req.user.id,
        req.body,
      );
      res.status(200).json({ data: report });
    } catch (error) {
      next(error);
    }
  },

  async updateReportPhoto(req, res, next) {
    try {
      const report = await reportService.updateReportPhoto(
        Number(req.params.id),
        req.user.id,
        req.file,
      );
      res.status(200).json({ data: report });
    } catch (error) {
      next(error);
    }
  },

  async deleteReport(req, res, next) {
    try {
      await reportService.deleteReport(Number(req.params.id), req.user.id);
      res.status(200).json({
        data: {
          message: 'Laporan berhasil dihapus.',
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const report = await reportService.updateStatus(
        Number(req.params.id),
        req.user.id,
        req.body,
      );
      res.status(200).json({ data: report });
    } catch (error) {
      next(error);
    }
  },

  async updateUrgency(req, res, next) {
    try {
      const report = await reportService.updateUrgency(Number(req.params.id), req.body);
      res.status(200).json({ data: report });
    } catch (error) {
      next(error);
    }
  },

  async getReportHistory(req, res, next) {
    try {
      const history = await reportService.getReportHistory(Number(req.params.id));
      res.status(200).json({ data: history });
    } catch (error) {
      next(error);
    }
  },

  async getReportPhoto(req, res, next) {
    try {
      const filePath = await reportService.getPhotoFilePath(Number(req.params.id));
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  },
};
