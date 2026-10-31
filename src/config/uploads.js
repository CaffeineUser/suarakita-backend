import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export function getUploadDirectory() {
  const defaultDirectory = process.env.VERCEL ? join(tmpdir(), 'suarakita-uploads') : './uploads';
  return resolve(process.env.UPLOAD_DIR || defaultDirectory);
}
