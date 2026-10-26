import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { extname } from 'node:path';
import multer from 'multer';
import { getUploadDirectory } from '../config/uploads.js';
import { BadRequestError } from '../utils/errors.js';

const uploadDir = getUploadDirectory();
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.jpg';
    const uniqueName = `${Date.now()}-${randomBytes(12).toString('hex')}${safeExt}`;
    cb(null, uniqueName);
  },
});

function fileFilter(_req, file, cb) {
  const ext = extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestError(
        'Format file tidak didukung. Harap unggah foto dengan format JPG, JPEG, PNG, atau WebP.',
      ),
      false,
    );
  }
}

const maxFileSizeMB = Number(process.env.MAX_FILE_SIZE_MB) || 3;

export const uploadPhoto = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSizeMB * 1024 * 1024,
    files: 1,
  },
});
