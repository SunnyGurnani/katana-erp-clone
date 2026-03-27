import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadFile, getFileUrl, deleteFile, listFiles } from '../lib/storage';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf',
      'text/csv', 'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

// Upload a file (product image, document, etc.)
router.post('/', upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const { entityType, entityId, visibility } = req.body;
  const ext = path.extname(req.file.originalname);
  const prefix = visibility === 'public' ? 'public' : 'private';
  const filePath = `${prefix}/${entityType || 'general'}/${entityId || 'misc'}/${uuidv4()}${ext}`;

  await uploadFile(filePath, req.file.buffer, req.file.mimetype);
  const url = await getFileUrl(filePath);

  res.status(201).json({
    path: filePath,
    url,
    originalName: req.file.originalname,
    size: req.file.size,
    contentType: req.file.mimetype,
  });
});

// Upload product image specifically
router.post('/product-image', upload.single('image'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided' });

  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId required' });

  const ext = path.extname(req.file.originalname);
  const filePath = `public/products/${productId}/${uuidv4()}${ext}`;

  await uploadFile(filePath, req.file.buffer, req.file.mimetype);
  const url = await getFileUrl(filePath);

  res.status(201).json({ path: filePath, url });
});

// List files for an entity
router.get('/:entityType/:entityId', async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.params;
  const publicFiles = await listFiles(`public/${entityType}/${entityId}/`);
  const privateFiles = await listFiles(`private/${entityType}/${entityId}/`);
  const allFiles = [...publicFiles, ...privateFiles];

  const filesWithUrls = await Promise.all(
    allFiles.map(async (f) => ({ path: f, url: await getFileUrl(f) }))
  );

  res.json(filesWithUrls);
});

// Delete a file
router.delete('/', async (req: AuthRequest, res) => {
  const { path: filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'path required' });
  await deleteFile(filePath);
  res.json({ deleted: true });
});

export default router;
