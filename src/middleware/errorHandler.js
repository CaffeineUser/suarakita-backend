import multer from 'multer';
import { AppError } from '../utils/errors.js';

export function errorHandler(err, _req, res, _next) {
  // 1. AppError turunan kustom
  if (err instanceof AppError) {
    const responseBody = {
      error: {
        message: err.message,
      },
    };
    if (err.details && process.env.NODE_ENV !== 'production') {
      responseBody.error.details = err.details;
    }
    return res.status(err.statusCode).json(responseBody);
  }

  // 2. SyntaxError dari express.json() / body-parser
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        message: 'Format data JSON pada body permintaan tidak valid.',
      },
    });
  }

  // 3. Multer upload errors
  if (err instanceof multer.MulterError) {
    let message = 'Gagal mengunggah file.';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Ukuran file foto melebihi batas yang diizinkan (maksimal 3 MB).';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Field upload foto tidak sesuai. Gunakan field "photo".';
    }
    return res.status(400).json({
      error: {
        message,
      },
    });
  }

  // 4. JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: {
        message: 'Token autentikasi tidak valid.',
      },
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        message: 'Sesi telah berakhir. Silakan login kembali.',
      },
    });
  }

  // 5. SQLite Constraint Errors
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({
      error: {
        message: 'Data sudah ada atau duplikat.',
      },
    });
  }

  // 6. Default/Internal Server Error
  if (process.env.NODE_ENV !== 'production') {
    console.error('Unhandled Server Error:', err);
  }

  return res.status(500).json({
    error: {
      message: 'Terjadi kesalahan internal pada server.',
    },
  });
}
