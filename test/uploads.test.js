import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'vitest';
import { getUploadDirectory } from '../src/config/uploads.js';

test('upload directory uses /tmp by default on Vercel', () => {
  const originalVercel = process.env.VERCEL;
  const originalUploadDir = process.env.UPLOAD_DIR;

  try {
    process.env.VERCEL = '1';
    delete process.env.UPLOAD_DIR;
    assert.equal(getUploadDirectory(), resolve('/tmp/suarakita-uploads'));
  } finally {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;

    if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = originalUploadDir;
  }
});

test('upload directory respects explicit configuration', () => {
  const originalVercel = process.env.VERCEL;
  const originalUploadDir = process.env.UPLOAD_DIR;

  try {
    process.env.VERCEL = '1';
    process.env.UPLOAD_DIR = './custom-uploads';
    assert.equal(getUploadDirectory(), resolve('./custom-uploads'));
  } finally {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;

    if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = originalUploadDir;
  }
});

test('upload middleware handles storage, fallback extensions, and file filters', async () => {
  const { ensureUploadDir, uploadPhoto } = await import('../src/middleware/upload.js');
  const { mkdtempSync, rmSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  // Test ensureUploadDir creates directory when missing and skips when present
  const tempDir = join(tmpdir(), `test-upload-dir-${Date.now()}`);
  try {
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    ensureUploadDir(tempDir);
    assert.ok(existsSync(tempDir));
    // Calling again covers the false branch (already exists)
    ensureUploadDir(tempDir);
  } finally {
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
  }

  // Test destination callback
  await new Promise((resolveCb) => {
    uploadPhoto.storage.getDestination({}, {}, (err, dest) => {
      assert.equal(err, null);
      assert.ok(dest);
      resolveCb();
    });
  });

  // Test filename callback with allowed extension
  await new Promise((resolveCb) => {
    uploadPhoto.storage.getFilename({}, { originalname: 'avatar.PNG' }, (err, filename) => {
      assert.equal(err, null);
      assert.ok(filename.endsWith('.png'));
      resolveCb();
    });
  });

  // Test filename callback with disallowed extension fallback to .jpg
  await new Promise((resolveCb) => {
    uploadPhoto.storage.getFilename({}, { originalname: 'avatar.exe' }, (err, filename) => {
      assert.equal(err, null);
      assert.ok(filename.endsWith('.jpg'));
      resolveCb();
    });
  });

  // Test fileFilter with allowed and disallowed combinations
  const testFilter = (mimetype, originalname) =>
    new Promise((resolveCb) => {
      uploadPhoto.fileFilter({}, { mimetype, originalname }, (err, accepted) => {
        resolveCb({ accepted, err });
      });
    });

  const valid = await testFilter('image/jpeg', 'test.jpg');
  assert.equal(valid.accepted, true);
  assert.equal(valid.err, null);

  const invalidMime = await testFilter('application/pdf', 'test.jpg');
  assert.equal(invalidMime.accepted, false);
  assert.ok(invalidMime.err);

  const invalidExt = await testFilter('image/jpeg', 'test.pdf');
  assert.equal(invalidExt.accepted, false);
  assert.ok(invalidExt.err);

  const invalidBoth = await testFilter('text/plain', 'test.txt');
  assert.equal(invalidBoth.accepted, false);
  assert.ok(invalidBoth.err);
});
