import { categoryRepository } from '../repositories/categoryRepository.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';

export const categoryService = {
  async getAllCategories(userRole = null) {
    // Jika admin, tampilkan semua (termasuk yang tidak aktif jika ada), jika publik/warga tampilkan yang aktif
    const onlyActive = userRole !== 'admin';
    return categoryRepository.findAll({ onlyActive });
  },

  async getCategoryById(id) {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundError('Kategori tidak ditemukan.');
    }
    return category;
  },

  async createCategory({ name, description }) {
    const existing = await categoryRepository.findByName(name);
    if (existing) {
      throw new ConflictError('Kategori dengan nama tersebut sudah ada.');
    }
    return categoryRepository.create({ name, description });
  },

  async updateCategory(id, { name, description, is_active }) {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundError('Kategori tidak ditemukan.');
    }

    if (name && name.toLowerCase() !== category.name.toLowerCase()) {
      const existing = await categoryRepository.findByName(name);
      if (existing) {
        throw new ConflictError('Kategori dengan nama tersebut sudah ada.');
      }
    }

    return categoryRepository.update(id, { name, description, is_active });
  },

  async deleteCategory(id) {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundError('Kategori tidak ditemukan.');
    }

    const reportCount = await categoryRepository.countReportsByCategoryId(id);
    if (reportCount > 0) {
      throw new ConflictError(
        `Kategori tidak dapat dihapus karena masih digunakan oleh ${reportCount} laporan. Anda dapat menonaktifkannya.`,
      );
    }

    return categoryRepository.delete(id);
  },
};
