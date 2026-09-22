const bcrypt = require('bcryptjs');
const pool = require('../_db');
const {
    COOKIE_NAME,
    requireAuth
} = require('./_auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    const user = await requireAuth(req, res);

    if (!user) {
        return;
    }

    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!currentPassword || !newPassword) {
        return res.status(400).json({
            error: '현재 비밀번호와 새 비밀번호를 입력해주세요.'
        });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({
            error: '새 비밀번호는 8자 이상이어야 합니다.'
        });
    }

    try {
        const [rows] = await pool.query(
            `SELECT password_hash
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: '사용자를 찾을 수 없습니다.'
            });
        }

        const passwordOk = await bcrypt.compare(
            currentPassword,
            rows[0].password_hash
        );

        if (!passwordOk) {
            return res.status(401).json({
                error: '현재 비밀번호가 올바르지 않습니다.'
            });
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 12);

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            await connection.query(
                `UPDATE users
                 SET password_hash = ?
                 WHERE id = ?`,
                [newPasswordHash, user.id]
            );

            // 비밀번호 변경 시 해당 사용자의 기존 세션 전부 무효화
            await connection.query(
                `DELETE FROM sessions
                 WHERE user_id = ?`,
                [user.id]
            );

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        const secure = process.env.VERCEL ? '; Secure' : '';

        res.setHeader(
            'Set-Cookie',
            `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
        );

        return res.status(200).json({
            ok: true,
            message: '비밀번호가 변경되었습니다. 다시 로그인해주세요.'
        });
    } catch (error) {
        console.error('Change password error:', error.message);

        return res.status(500).json({
            error: '비밀번호를 변경할 수 없습니다.'
        });
    }
};