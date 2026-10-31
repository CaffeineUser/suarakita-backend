import { afterEach, describe, expect, test } from 'vitest';
import {
  generateToken,
  validateJwtConfiguration,
  verifyToken,
} from '../utils/jwt.js';

const originalEnv = {
  nodeEnv: process.env.NODE_ENV,
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN,
};

afterEach(() => {
  if (originalEnv.nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv.nodeEnv;
  if (originalEnv.secret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalEnv.secret;
  if (originalEnv.expiresIn === undefined) delete process.env.JWT_EXPIRES_IN;
  else process.env.JWT_EXPIRES_IN = originalEnv.expiresIn;
});

describe('JWT configuration', () => {
  test('uses the development secret and default expiration', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;

    validateJwtConfiguration();
    const token = generateToken({ id: 1 });
    expect(verifyToken(token)).toMatchObject({ id: 1 });
  });

  test('rejects an invalid expiration outside production', () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_EXPIRES_IN = 'forever';

    expect(() => validateJwtConfiguration()).toThrow('JWT_EXPIRES_IN tidak valid');
  });

  test('requires a long secret and valid expiration in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'short';
    process.env.JWT_EXPIRES_IN = '1d';
    expect(() => validateJwtConfiguration()).toThrow('JWT_SECRET');

    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.JWT_EXPIRES_IN = '0d';
    expect(() => validateJwtConfiguration()).toThrow('JWT_EXPIRES_IN');
  });

  test('uses an explicit token expiration option and supplied secret', () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'custom-test-secret';
    process.env.JWT_EXPIRES_IN = 'bad-config-is-not-read';

    const token = generateToken({ id: 2 }, {
      expiresIn: '2h',
      issuer: 'suarakita-test',
    });
    expect(verifyToken(token)).toMatchObject({ id: 2, iss: 'suarakita-test' });
  });
});
