const pool = require('../_db');
const {
    COOKIE_NAME,
    getCookie,
    hashToken
} = require('./_auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    try {
        const token = getCookie(req, COOKIE_NAME);

        if (token) {
            const tokenHash = hashToken(token);

            await pool.query(
                'DELETE FROM sessions WHERE token_hash = ?',
                [tokenHash]
            );
        }

        const secure = process.env.VERCEL ? '; Secure' : '';

        res.setHeader(
            'Set-Cookie',
            `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
        );

        return res.status(200).json({
            ok: true
        });
    } catch (error) {
        console.error('Logout error:', error.message);

        return res.status(500).json({
            error: '로그아웃할 수 없습니다.'
        });
    }
};