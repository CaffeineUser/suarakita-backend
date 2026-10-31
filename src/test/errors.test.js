import { describe, expect, test } from 'vitest';
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
  UnprocessableEntityError,
} from '../src/utils/errors.js';

describe('application error types', () => {
  test.each([
    [BadRequestError, 'Permintaan tidak valid.', 400],
    [UnauthorizedError, 'Autentikasi diperlukan.', 401],
    [ForbiddenError, 'Anda tidak memiliki hak akses untuk tindakan ini.', 403],
    [NotFoundError, 'Sumber daya tidak ditemukan.', 404],
    [ConflictError, 'Terjadi konflik pada data yang diminta.', 409],
    [ServiceUnavailableError, 'Layanan sementara tidak tersedia.', 503],
    [UnprocessableEntityError, 'Data yang dikirim tidak dapat diproses.', 422],
  ])('provides default values for %s', (ErrorType, message, statusCode) => {
    const error = new ErrorType();
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe(message);
    expect(error.statusCode).toBe(statusCode);
    expect(error.details).toBeNull();
    expect(error.name).toBe(ErrorType.name);
  });

  test('preserves explicit message, status, and details', () => {
    const details = { field: 'name' };
    const baseError = new AppError('custom', 418, details);
    const typedError = new BadRequestError('bad input', details);

    expect(baseError).toMatchObject({
      message: 'custom',
      statusCode: 418,
      details,
      name: 'AppError',
    });
    expect(typedError).toMatchObject({
      message: 'bad input',
      statusCode: 400,
      details,
    });
  });
});
