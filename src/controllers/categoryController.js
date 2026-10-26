import { categoryService } from '../services/categoryService.js';

export const categoryController = {
  async getAllCategories(req, res, next) {
    try {
      const userRole = req.user?.role || null;
      const categories = await categoryService.getAllCategories(userRole);
      res.status(200).json({ data: categories });
    } catch (error) {
      next(error);
    }
  },

  async getCategoryById(req, res, next) {
    try {
      const category = await categoryService.getCategoryById(Number(req.params.id));
      res.status(200).json({ data: category });
    } catch (error) {
      next(error);
    }
  },

  async createCategory(req, res, next) {
    try {
      const category = await categoryService.createCategory(req.body);
      res.status(201).json({ data: category });
    } catch (error) {
      next(error);
    }
  },

  async updateCategory(req, res, next) {
    try {
      const category = await categoryService.updateCategory(Number(req.params.id), req.body);
      res.status(200).json({ data: category });
    } catch (error) {
      next(error);
    }
  },

  async deleteCategory(req, res, next) {
    try {
      await categoryService.deleteCategory(Number(req.params.id));
      res.status(200).json({
        data: {
          message: 'Kategori berhasil dihapus.',
        },
      });
    } catch (error) {
      next(error);
    }
  },
};
