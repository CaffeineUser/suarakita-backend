import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Nama wajib diisi.' })
    .trim()
    .min(3, 'Nama minimal harus 3 karakter.')
    .max(100, 'Nama maksimal 100 karakter.'),
  email: z
    .string({ required_error: 'Email wajib diisi.' })
    .trim()
    .email('Format email tidak valid.')
    .max(255, 'Email maksimal 255 karakter.'),
  password: z
    .string({ required_error: 'Kata sandi wajib diisi.' })
    .min(8, 'Kata sandi minimal 8 karakter.')
    .max(100, 'Kata sandi maksimal 100 karakter.'),
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email wajib diisi.' })
    .trim()
    .email('Format email tidak valid.'),
  password: z
    .string({ required_error: 'Kata sandi wajib diisi.' })
    .min(1, 'Kata sandi wajib diisi.'),
});
