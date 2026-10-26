export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Permintaan tidak valid.', details = null) {
    super(message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Autentikasi diperlukan.', details = null) {
    super(message, 401, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Anda tidak memiliki hak akses untuk tindakan ini.', details = null) {
    super(message, 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Sumber daya tidak ditemukan.', details = null) {
    super(message, 404, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Terjadi konflik pada data yang diminta.', details = null) {
    super(message, 409, details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Layanan sementara tidak tersedia.', details = null) {
    super(message, 503, details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Data yang dikirim tidak dapat diproses.', details = null) {
    super(message, 422, details);
  }
}
