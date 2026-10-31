import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { authenticate, authorize, optionalAuthenticate } from '../src/middleware/auth.js';
import { userRepository } from '../src/repositories/userRepository.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const originalJwtSecret = process.env.JWT_SECRET;

beforeAll(() => {
  process.env.JWT_SECRET = 'middleware-test-secret-that-is-long-enough';
});

afterAll(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

function requestWithToken(token) {
  return { headers: { authorization: `Bearer ${token}` } };
}

describe('authentication middleware error and optional paths', () => {
  test('forwards database failures after verifying a token', async () => {
    const error = new Error('database unavailable');
    vi.spyOn(userRepository, 'findById').mockRejectedValue(error);
    const next = vi.fn();

    await authenticate(requestWithToken(jwt.sign({ id: 8 }, process.env.JWT_SECRET)), {}, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  test('reports an expired authentication token', async () => {
    const token = jwt.sign({ id: 8 }, process.env.JWT_SECRET, { expiresIn: -1 });
    const next = vi.fn();

    await authenticate(requestWithToken(token), {}, next);

    expect(next.mock.calls[0][0].message).toContain('Sesi telah berakhir');
  });

  test('accepts a token for an existing user and rejects a missing user', async () => {
    const token = jwt.sign({ id: 8 }, process.env.JWT_SECRET);
    const user = { id: 8, role: 'warga' };
    vi.spyOn(userRepository, 'findById').mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    const authenticatedRequest = requestWithToken(token);
    const next = vi.fn();

    await authenticate(authenticatedRequest, {}, next);
    expect(authenticatedRequest.user).toBe(user);
    expect(next).toHaveBeenCalledWith();

    const rejectedNext = vi.fn();
    await authenticate(requestWithToken(token), {}, rejectedNext);
    expect(rejectedNext.mock.calls[0][0].message).toContain('Pengguna tidak ditemukan');
  });

  test('optional authentication ignores invalid tokens but forwards lookup errors', async () => {
    const noHeaderRequest = { headers: {} };
    const noHeaderNext = vi.fn();
    await optionalAuthenticate(noHeaderRequest, {}, noHeaderNext);
    expect(noHeaderRequest.user).toBeNull();

    const unauthenticatedRequest = { headers: { authorization: 'Basic token' } };
    const next = vi.fn();
    await optionalAuthenticate(unauthenticatedRequest, {}, next);
    expect(unauthenticatedRequest.user).toBeNull();

    const invalidRequest = requestWithToken('not-a-valid-token');
    const invalidNext = vi.fn();
    await optionalAuthenticate(invalidRequest, {}, invalidNext);
    expect(invalidRequest.user).toBeNull();
    expect(invalidNext).toHaveBeenCalledOnce();

    const dbError = new Error('lookup failed');
    vi.spyOn(userRepository, 'findById').mockRejectedValue(dbError);
    const failureNext = vi.fn();
    await optionalAuthenticate(
      requestWithToken(jwt.sign({ id: 8 }, process.env.JWT_SECRET)),
      {},
      failureNext,
    );
    expect(failureNext).toHaveBeenCalledWith(dbError);
  });

  test('optional authentication sets an existing user or null for a missing user', async () => {
    const user = { id: 8, role: 'warga' };
    vi.spyOn(userRepository, 'findById').mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    const token = jwt.sign({ id: 8 }, process.env.JWT_SECRET);
    const authedRequest = requestWithToken(token);
    await optionalAuthenticate(authedRequest, {}, vi.fn());
    expect(authedRequest.user).toBe(user);

    const missingRequest = requestWithToken(token);
    await optionalAuthenticate(missingRequest, {}, vi.fn());
    expect(missingRequest.user).toBeNull();
  });

  test('authorize enforces roles', () => {
    const missingNext = vi.fn();
    authorize('admin')({ user: null }, {}, missingNext);
    expect(missingNext.mock.calls[0][0].statusCode).toBe(401);

    const forbiddenNext = vi.fn();
    authorize('admin')({ user: { role: 'warga' } }, {}, forbiddenNext);
    expect(forbiddenNext.mock.calls[0][0].statusCode).toBe(403);

    const allowedNext = vi.fn();
    authorize('admin')({ user: { role: 'admin' } }, {}, allowedNext);
    expect(allowedNext).toHaveBeenCalledWith();
  });
});
