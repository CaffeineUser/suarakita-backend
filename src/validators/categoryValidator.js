import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z
    .string({ required_error: 'Nama kategori wajib diisi.' })
    .trim()
    .min(2, 'Nama kategori minimal 2 karakter.')
    .max(100, 'Nama kategori maksimal 100 karakter.'),
  description: z
    .string()
    .trim()
    .max(500, 'Deskripsi maksimal 500 karakter.')
    .optional()
    .nullable(),
});

export const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nama kategori minimal 2 karakter.')
    .max(100, 'Nama kategori maksimal 100 karakter.')
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, 'Deskripsi maksimal 500 karakter.')
    .optional()
    .nullable(),
  is_active: z
    .union([z.boolean(), z.number().int().min(0).max(1)])
    .optional(),
});
