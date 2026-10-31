import { describe, expect, test, vi } from 'vitest';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validate.js';
import {
  createReportSchema,
  queryReportsSchema,
  updateReportSchema,
  updateStatusSchema,
  updateUrgencySchema,
} from '../validators/reportValidator.js';

function runValidator(validator, input) {
  const request = { ...input };
  const next = vi.fn();
  validator(request, {}, next);
  return { next, request };
}

describe('request validators', () => {
  test('validates body and query data and replaces input with parsed output', () => {
    const body = runValidator(validateBody(createReportSchema), {
      body: {
        title: '  Jalan Rusak  ',
        category_id: '1',
        description: '  Deskripsi laporan cukup panjang  ',
        location_name: '  Jalan Merdeka  ',
        latitude: '',
        longitude: undefined,
      },
    });
    expect(body.next).toHaveBeenCalledWith();
    expect(body.request.body).toMatchObject({
      title: 'Jalan Rusak',
      category_id: 1,
      latitude: null,
      longitude: null,
    });

    const query = runValidator(validateQuery({
      safeParse: (input) => ({ success: true, data: { page: Number(input.page) } }),
    }), { query: { page: '2' } });
    expect(query.request.query.page).toBe(2);
    expect(query.next).toHaveBeenCalledWith();
  });

  test.each([
    [validateBody, 'body', 'Data input tidak valid.'],
    [validateQuery, 'query', 'Query parameter tidak valid.'],
    [validateParams, 'params', 'Parameter URL tidak valid.'],
  ])('returns the fallback message when a schema has no issue details', (factory, key, fallback) => {
    const validator = factory({
      safeParse: () => ({
        success: false,
        error: { issues: [], format: () => ({}) },
      }),
    });
    const { next } = runValidator(validator, { [key]: {} });
    expect(next.mock.calls[0][0].message).toBe(fallback);
  });

  test('validates URL params and rejects a malformed id', () => {
    const validator = validateParams({
      safeParse: (params) => params.id === '12'
        ? { success: true, data: { id: 12 } }
        : {
            success: false,
            error: {
              issues: [{ message: 'ID tidak valid.' }],
              format: () => ({ id: 'invalid' }),
            },
          },
    });
    const valid = runValidator(validator, { params: { id: '12' } });
    expect(valid.request.params.id).toBe(12);
    expect(valid.next).toHaveBeenCalledWith();

    const invalid = runValidator(validator, { params: { id: 'bad' } });
    expect(invalid.next.mock.calls[0][0].message).toBe('ID tidak valid.');
  });

  test('report schemas cover optional coordinate and status branches', () => {
    // Test all branches of latitude and longitude preprocessor in createReportSchema: '', null, undefined, and valid number string
    for (const lat of ['', null, undefined, '10.5']) {
      for (const lng of ['', null, undefined, '106.8']) {
        expect(createReportSchema.safeParse({
          title: 'Laporan Jalan',
          category_id: 1,
          description: 'Deskripsi laporan jalan rusak',
          location_name: 'Jalan Merdeka',
          latitude: lat,
          longitude: lng,
        }).success).toBe(true);
      }
    }

    const invalidUrgency = createReportSchema.safeParse({
      title: 'Laporan Jalan',
      category_id: 1,
      description: 'Deskripsi laporan jalan rusak',
      location_name: 'Jalan Merdeka',
      urgency: 'invalid',
    });
    expect(invalidUrgency.success).toBe(false);
    expect(invalidUrgency.error.issues[0].message).toContain('Tingkat urgensi');

    // Test all branches of latitude and longitude preprocessor in updateReportSchema: '', null, undefined, and valid number string
    for (const lat of ['', null, undefined, '10.5']) {
      for (const lng of ['', null, undefined, '106.8']) {
        expect(updateReportSchema.safeParse({
          latitude: lat,
          longitude: lng,
          urgency: 'kritis',
        }).success).toBe(true);
      }
    }
    expect(updateReportSchema.safeParse({ latitude: 'invalid' }).success).toBe(false);
    expect(updateReportSchema.safeParse({ longitude: 'invalid' }).success).toBe(false);

    const invalidStatus = updateStatusSchema.safeParse({ status: 'invalid' });
    expect(invalidStatus.success).toBe(false);
    expect(invalidStatus.error.issues[0].message).toContain('Status harus salah satu dari');
    expect(updateStatusSchema.safeParse({ status: 'selesai', note: 'Sudah beres' }).success).toBe(true);
    expect(updateStatusSchema.safeParse({ status: 'diajukan', note: null }).success).toBe(true);

    const invalidUrgencyDirect = updateUrgencySchema.safeParse({ urgency: 'sangat_kritis' });
    expect(invalidUrgencyDirect.success).toBe(false);
    expect(invalidUrgencyDirect.error.issues[0].message).toContain('Tingkat urgensi');
    expect(updateUrgencySchema.safeParse({ urgency: 'tinggi' }).success).toBe(true);

    expect(queryReportsSchema.safeParse({
      q: 'jalan',
      category_id: '2',
      status: 'diproses',
      urgency: 'tinggi',
      sort: 'created_at',
      order: 'asc',
      page: '2',
      limit: '20',
    }).success).toBe(true);
  });
});
