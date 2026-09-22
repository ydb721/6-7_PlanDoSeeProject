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

    const password = String(req.body?.password || '');

    if (!password) {
        return res.status(400).json({
            error: '비밀번호를 입력해주세요.'
        });
    }

    const connection = await pool.getConnection();

    try {
        // 삭제 전 비밀번호 재확인
        const [rows] = await connection.query(
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
            password,
            rows[0].password_hash
        );

        if (!passwordOk) {
            return res.status(401).json({
                error: '비밀번호가 올바르지 않습니다.'
            });
        }

        await connection.beginTransaction();

        // executions → tasks → history → plans 순서로 삭제
        await connection.query(
            `DELETE e
             FROM executions e
             JOIN tasks t ON t.id = e.task_id
             JOIN plans p ON p.id = t.plan_id
             WHERE p.user_id = ?`,
            [user.id]
        );

        await connection.query(
            `DELETE t
             FROM tasks t
             JOIN plans p ON p.id = t.plan_id
             WHERE p.user_id = ?`,
            [user.id]
        );

        await connection.query(
            `DELETE h
             FROM plan_history h
             JOIN plans p ON p.id = h.plan_id
             WHERE p.user_id = ?`,
            [user.id]
        );

        await connection.query(
            `DELETE FROM improvements
             WHERE user_id = ?`,
            [user.id]
        );

        await connection.query(
            `DELETE FROM plans
             WHERE user_id = ?`,
            [user.id]
        );

        // sessions는 FK ON DELETE CASCADE지만 명시적으로 먼저 삭제
        await connection.query(
            `DELETE FROM sessions
             WHERE user_id = ?`,
            [user.id]
        );

        await connection.query(
            `DELETE FROM users
             WHERE id = ?`,
            [user.id]
        );

        await connection.commit();

        const secure = process.env.VERCEL ? '; Secure' : '';

        res.setHeader(
            'Set-Cookie',
            `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
        );

        return res.status(200).json({
            ok: true,
            message: '계정과 계정에 연결된 데이터가 삭제되었습니다.'
        });
    } catch (error) {
        try {
            await connection.rollback();
        } catch {}

        console.error('Delete account error:', error.message);

        return res.status(500).json({
            error: '계정을 삭제할 수 없습니다.'
        });
    } finally {
        connection.release();
    }
};