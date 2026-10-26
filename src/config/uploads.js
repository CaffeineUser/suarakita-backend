import { resolve } from 'node:path';

export function getUploadDirectory() {
  const defaultDirectory = process.env.VERCEL ? '/tmp/suarakita-uploads' : './uploads';
  return resolve(process.env.UPLOAD_DIR || defaultDirectory);
}
