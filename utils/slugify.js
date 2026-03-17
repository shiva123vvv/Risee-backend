const pool = require('../config/db').pool;

const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w-]+/g, '')   // Remove all non-word chars
        .replace(/--+/g, '-');      // Replace multiple - with single -
};

const generateUniqueSlug = async (title, table = 'campaigns', column = 'slug') => {
    let slug = slugify(title);
    let originalSlug = slug;
    let count = 1;
    
    while (true) {
        const result = await pool.query(`SELECT 1 FROM ${table} WHERE ${column} = $1`, [slug]);
        if (result.rows.length === 0) {
            return slug;
        }
        slug = `${originalSlug}-${count}`;
        count++;
    }
};

const generateUniqueUsername = async (nameOrEmail) => {
    let base = slugify(nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail);
    let username = base;
    let count = 1;

    while (true) {
        const result = await pool.query(`SELECT 1 FROM users WHERE username = $1`, [username]);
        if (result.rows.length === 0) {
            return username;
        }
        username = `${base}${count}`;
        count++;
    }
};

module.exports = { slugify, generateUniqueSlug, generateUniqueUsername };
