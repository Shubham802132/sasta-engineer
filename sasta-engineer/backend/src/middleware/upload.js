const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024;

const ALLOWED_MIME = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
]);

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeBase = path
            .basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 40);
        cb(null, `${Date.now()}-${safeBase}${ext}`);
    }
});

const fileFilter = (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
        return cb(new Error('Invalid file type. Allowed: JPEG, PNG, WebP, PDF'));
    }
    cb(null, true);
};

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE, files: 3 },
    fileFilter
});

module.exports = {
    upload,
    UPLOAD_DIR,
    MAX_FILE_SIZE
};
