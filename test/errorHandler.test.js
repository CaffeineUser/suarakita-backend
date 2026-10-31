import assert from 'node:assert/strict';
import multer from 'multer';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { errorHandler } from '../src/middleware/errorHandler.js';
import {
  AppError,
  BadRequestError,
  NotFoundError,
} from '../src/utils/errors.js';

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorHandler', () => {
  test('returns AppError details outside production and omits them in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const response = createResponse();
    const next = vi.fn();

    process.env.NODE_ENV = 'test';
    errorHandler(new BadRequestError('Tidak valid', { field: 'name' }), {}, response, next);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: { message: 'Tidak valid', details: { field: 'name' } },
    });

    response.status.mockClear();
    response.json.mockClear();
    process.env.NODE_ENV = 'production';
    errorHandler(new BadRequestError('Tidak valid', { field: 'name' }), {}, response, next);
    expect(response.json).toHaveBeenCalledWith({ error: { message: 'Tidak valid' } });

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  test('handles syntax errors from JSON parsing', () => {
    const error = new SyntaxError('invalid JSON');
    error.status = 400;
    error.body = '{';
    const response = createResponse();

    errorHandler(error, {}, response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: { message: 'Format data JSON pada body permintaan tidak valid.' },
    });
  });

  test.each([
    ['LIMIT_FILE_SIZE', 'Ukuran file foto melebihi batas yang diizinkan (maksimal 3 MB).'],
    ['LIMIT_UNEXPECTED_FILE', 'Field upload foto tidak sesuai. Gunakan field "photo".'],
    ['LIMIT_PART_COUNT', 'Gagal mengunggah file.'],
  ])('handles multer error %s', (code, message) => {
    const response = createResponse();
    errorHandler(new multer.MulterError(code), {}, response, vi.fn());
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: { message } });
  });

  test.each([
    ['JsonWebTokenError', 401, 'Token autentikasi tidak valid.'],
    ['TokenExpiredError', 401, 'Sesi telah berakhir. Silakan login kembali.'],
  ])('handles %s', (name, status, message) => {
    const response = createResponse();
    const error = new Error('token error');
    error.name = name;

    errorHandler(error, {}, response, vi.fn());
    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({ error: { message } });
  });

  test('maps unique constraint errors to conflict responses', () => {
    const response = createResponse();
    const error = new Error('duplicate');
    error.code = 'SQLITE_CONSTRAINT_UNIQUE';

    errorHandler(error, {}, response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      error: { message: 'Data sudah ada atau duplikat.' },
    });
  });

  test('returns a generic server error and logs only outside production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const error = new Error('internal');
    const response = createResponse();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    process.env.NODE_ENV = 'test';
    errorHandler(error, {}, response, vi.fn());
    expect(consoleError).toHaveBeenCalledWith('Unhandled Server Error:', error);
    expect(response.status).toHaveBeenCalledWith(500);

    consoleError.mockClear();
    response.status.mockClear();
    process.env.NODE_ENV = 'production';
    errorHandler(error, {}, response, vi.fn());
    expect(consoleError).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(500);

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  test('accepts an AppError without details', () => {
    const response = createResponse();
    errorHandler(new NotFoundError('missing'), {}, response, vi.fn());
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ error: { message: 'missing' } });
  });

  test('accepts a base AppError and syntax errors missing body metadata as generic failures', () => {
    const response = createResponse();
    errorHandler(new AppError('custom', 422), {}, response, vi.fn());
    expect(response.status).toHaveBeenCalledWith(422);

    response.status.mockClear();
    const syntaxError = new SyntaxError('not a body-parser error');
    syntaxError.status = 400;
    errorHandler(syntaxError, {}, response, vi.fn());
    expect(response.status).toHaveBeenCalledWith(500);
  });
});
