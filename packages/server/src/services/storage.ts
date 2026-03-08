import { mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { ModelFormat, ModelFile } from '@bentar/shared';

const UPLOADS_DIR = 'uploads';

export async function ensureUploadsDir(): Promise<void> {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

export function getModelFormat(filename: string): ModelFormat | null {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.ifc': return 'ifc';
    case '.gltf': return 'gltf';
    case '.glb': return 'glb';
    default: return null;
  }
}

export function createModelRecord(
  projectId: string,
  originalFilename: string,
  storedFilename: string,
  format: ModelFormat,
  size: number,
  uploadedBy: string,
): ModelFile {
  return {
    id: uuidv4(),
    projectId,
    filename: storedFilename,
    originalFilename,
    format,
    size,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
    path: `/${UPLOADS_DIR}/${storedFilename}`,
  };
}

export function getUploadsDir(): string {
  return UPLOADS_DIR;
}
