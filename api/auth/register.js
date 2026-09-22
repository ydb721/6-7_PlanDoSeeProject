const bcrypt = require('bcryptjs');
const pool = require('../_db');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
        return res.status(400).json({
            error: '아이디와 비밀번호를 입력해주세요.'
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            error: '비밀번호는 8자 이상이어야 합니다.'
        });
    }

    try {
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE username = ? LIMIT 1',
            [username]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                error: '이미 사용 중인 아이디입니다.'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            [username, passwordHash]
        );

        return res.status(201).json({
            ok: true,
            user: {
                id: result.insertId,
                username
            }
        });
    } catch (error) {
        console.error('Register error:', error.message);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: '이미 사용 중인 아이디입니다.'
            });
        }

        return res.status(500).json({
            error: '계정을 만들 수 없습니다.'
        });
    }
};