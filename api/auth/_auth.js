const crypto = require('crypto');
const pool = require('../_db');

const COOKIE_NAME = 'pds_session';

function getCookie(req, name) {
    const cookieHeader = req.headers.cookie || '';

    const cookies = cookieHeader.split(';').map(cookie => cookie.trim());

    for (const cookie of cookies) {
        const index = cookie.indexOf('=');

        if (index === -1) continue;

        const key = cookie.slice(0, index);
        const value = cookie.slice(index + 1);

        if (key === name) {
            return decodeURIComponent(value);
        }
    }

    return null;
}

function hashToken(token) {
    return crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
}

async function getCurrentUser(req) {
    const token = getCookie(req, COOKIE_NAME);

    if (!token) {
        return null;
    }

    const tokenHash = hashToken(token);

    const [rows] = await pool.query(
        `SELECT
            users.id,
            users.username,
            sessions.id AS session_id
         FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = ?
           AND sessions.expires_at > NOW()
         LIMIT 1`,
        [tokenHash]
    );

    return rows[0] || null;
}

async function requireAuth(req, res) {
    const user = await getCurrentUser(req);

    if (!user) {
        res.status(401).json({
            error: '로그인이 필요합니다.'
        });

        return null;
    }

    return user;
}

module.exports = {
    COOKIE_NAME,
    getCookie,
    hashToken,
    getCurrentUser,
    requireAuth
};