import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Nama minimal harus 3 karakter.')
    .max(100, 'Nama maksimal 100 karakter.')
    .optional(),
  current_password: z.string().optional(),
  new_password: z
    .string()
    .min(8, 'Kata sandi baru minimal 8 karakter.')
    .max(100, 'Kata sandi baru maksimal 100 karakter.')
    .optional(),
});
