const multer = require('multer');
const db = require('./db');

function PostgresStorage() {}

PostgresStorage.prototype._handleFile = function _handleFile(req, file, cb) {
    const filename = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const bufs = [];
    file.stream.on('data', function (chunk) { bufs.push(chunk); });
    file.stream.on('end', async function () {
        const buffer = Buffer.concat(bufs);
        const dataStr = buffer.toString('base64');
        try {
            await db.query(
                'INSERT INTO app_images (filename, data, mimetype) VALUES ($1, $2, $3)', 
                [filename, dataStr, file.mimetype]
            );
            cb(null, { filename: filename, path: '/uploads/' + filename, size: buffer.length });
        } catch (err) {
            cb(err);
        }
    });
    file.stream.on('error', cb);
};

PostgresStorage.prototype._removeFile = function _removeFile(req, file, cb) {
    db.query('DELETE FROM app_images WHERE filename = $1', [file.filename])
      .then(() => cb(null))
      .catch(cb);
};

const upload = multer({ 
    storage: new PostgresStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

module.exports = upload;
