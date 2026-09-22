const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../_db');
const { COOKIE_NAME, hashToken } = require('./_auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    const loginError = {
        error: '아이디 또는 비밀번호가 올바르지 않습니다.'
    };

    if (!username || !password) {
        return res.status(401).json(loginError);
    }

    try {
        const [rows] = await pool.query(
            'SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json(loginError);
        }

        const user = rows[0];
        const passwordOk = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordOk) {
            return res.status(401).json(loginError);
        }

        // 로그인 성공: 예측하기 어려운 세션 토큰 생성
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(token);

        // 세션은 7일 뒤 만료
        await pool.query(
            `INSERT INTO sessions (user_id, token_hash, expires_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
            [user.id, tokenHash]
        );

        const secure = process.env.VERCEL ? '; Secure' : '';

        res.setHeader(
            'Set-Cookie',
            `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`
        );

        return res.status(200).json({
            ok: true,
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Login error:', error.message);

        return res.status(500).json({
            error: '로그인할 수 없습니다.'
        });
    }
};