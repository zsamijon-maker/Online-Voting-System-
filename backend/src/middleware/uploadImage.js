import multer from 'multer';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Only JPEG and PNG images are allowed.'));
    }
    cb(null, true);
  },
});

export const parseImageUpload = (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image must be 2MB or smaller.' });
      }
      return res.status(400).json({ error: error.message });
    }

    return res.status(400).json({ error: error.message || 'Invalid image upload.' });
  });
};
