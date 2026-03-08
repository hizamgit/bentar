import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ALL_SUPPORTED_EXTENSIONS } from '@bentar/shared';
import { ensureUploadsDir, getModelFormat, createModelRecord, getUploadsDir } from '../services/storage.js';
import { addModelToProject } from './projects.js';

const router = Router();

// Configure multer
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await ensureUploadsDir();
    cb(null, getUploadsDir());
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALL_SUPPORTED_EXTENSIONS.includes(ext as typeof ALL_SUPPORTED_EXTENSIONS[number])) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file format: ${ext}. Supported: ${ALL_SUPPORTED_EXTENSIONS.join(', ')}`));
    }
  },
});

// POST /api/upload
router.post('/', upload.single('model'), (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const projectId = req.body.projectId as string | undefined;
  const uploadedBy = req.body.userId as string | undefined ?? 'anonymous';

  const format = getModelFormat(file.originalname);
  if (!format) {
    res.status(400).json({ error: 'Could not determine file format' });
    return;
  }

  const model = createModelRecord(
    projectId ?? '',
    file.originalname,
    file.filename,
    format,
    file.size,
    uploadedBy,
  );

  // Add to project if projectId is provided
  if (projectId) {
    addModelToProject(projectId, model);
  }

  res.status(201).json(model);
});

export { router as uploadRouter };
