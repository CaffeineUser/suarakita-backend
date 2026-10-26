import { z } from 'zod';

const urgencyEnum = z.enum(['rendah', 'sedang', 'tinggi', 'kritis'], {
  errorMap: () => ({ message: "Tingkat urgensi harus salah satu dari: 'rendah', 'sedang', 'tinggi', atau 'kritis'." }),
});

const statusEnum = z.enum(['diajukan', 'diverifikasi', 'diproses', 'selesai', 'ditolak'], {
  errorMap: () => ({ message: "Status harus salah satu dari: 'diajukan', 'diverifikasi', 'diproses', 'selesai', atau 'ditolak'." }),
});

export const createReportSchema = z.object({
  title: z
    .string({ required_error: 'Judul laporan wajib diisi.' })
    .trim()
    .min(5, 'Judul laporan minimal 5 karakter.')
    .max(150, 'Judul laporan maksimal 150 karakter.'),
  category_id: z.coerce
    .number({ required_error: 'Kategori wajib dipilih.' })
    .int('ID kategori harus bilangan bulat.')
    .positive('ID kategori tidak valid.'),
  description: z
    .string({ required_error: 'Deskripsi laporan wajib diisi.' })
    .trim()
    .min(10, 'Deskripsi laporan minimal 10 karakter.')
    .max(5000, 'Deskripsi laporan maksimal 5000 karakter.'),
  location_name: z
    .string({ required_error: 'Nama lokasi wajib diisi.' })
    .trim()
    .min(3, 'Nama lokasi minimal 3 karakter.')
    .max(300, 'Nama lokasi maksimal 300 karakter.'),
  urgency: urgencyEnum.default('sedang'),
  latitude: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().min(-90, 'Latitude harus di antara -90 dan 90.').max(90, 'Latitude harus di antara -90 dan 90.').nullable().optional(),
  ),
  longitude: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().min(-180, 'Longitude harus di antara -180 dan 180.').max(180, 'Longitude harus di antara -180 dan 180.').nullable().optional(),
  ),
});

export const updateReportSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Judul laporan minimal 5 karakter.')
    .max(150, 'Judul laporan maksimal 150 karakter.')
    .optional(),
  category_id: z.coerce
    .number()
    .int('ID kategori harus bilangan bulat.')
    .positive('ID kategori tidak valid.')
    .optional(),
  description: z
    .string()
    .trim()
    .min(10, 'Deskripsi laporan minimal 10 karakter.')
    .max(5000, 'Deskripsi laporan maksimal 5000 karakter.')
    .optional(),
  location_name: z
    .string()
    .trim()
    .min(3, 'Nama lokasi minimal 3 karakter.')
    .max(300, 'Nama lokasi maksimal 300 karakter.')
    .optional(),
  urgency: urgencyEnum.optional(),
  latitude: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().min(-90).max(90).nullable().optional(),
  ),
  longitude: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().min(-180).max(180).nullable().optional(),
  ),
});

export const updateStatusSchema = z.object({
  status: statusEnum,
  note: z.string().trim().max(500, 'Catatan maksimal 500 karakter.').optional().nullable(),
});

export const updateUrgencySchema = z.object({
  urgency: urgencyEnum,
});

export const queryReportsSchema = z.object({
  q: z.string().trim().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  status: statusEnum.optional(),
  urgency: urgencyEnum.optional(),
  sort: z.enum(['priority_score', 'created_at', 'urgency', 'title', 'support_count']).optional().default('priority_score'),
  order: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});
