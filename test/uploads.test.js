import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
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

test('upload directory uses the persistent deployment mount when configured', () => {
  const originalVercel = process.env.VERCEL;
  const originalRender = process.env.RENDER;
  const originalUploadDir = process.env.UPLOAD_DIR;

  try {
    delete process.env.VERCEL;
    process.env.RENDER = 'true';
    process.env.UPLOAD_DIR = '/var/data/uploads';
    assert.equal(getUploadDirectory(), resolve('/var/data/uploads'));
  } finally {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;

    if (originalRender === undefined) delete process.env.RENDER;
    else process.env.RENDER = originalRender;

    if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = originalUploadDir;
  }
});
