const db = require('./_db');
const { requireAuth } = require('./auth/_auth');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    const user = await requireAuth(req, res);

    if (!user) {
        return;
    }

    const p = req.body;

    try {
        const [[task]] = await db.query(
            `SELECT t.id
             FROM tasks t
             JOIN plans pl ON pl.id = t.plan_id
             WHERE t.id = ?
               AND t.deleted = 0
               AND pl.user_id = ?`,
            [p.task_id, user.id]
        );

        if (!task) {
            return res.status(404).json({
                error: '할 일을 찾을 수 없습니다.'
            });
        }

        const mins = Math.max(
            0,
            Math.round(
                (new Date(p.ended_at) - new Date(p.started_at)) / 60000
            )
        );

        await db.query(
            `INSERT INTO executions
                (task_id, started_at, ended_at, actual_minutes, blocked_reason)
             VALUES (?, ?, ?, ?, ?)`,
            [
                p.task_id,
                p.started_at.replace('T', ' '),
                p.ended_at.replace('T', ' '),
                mins,
                p.blocked_reason || null
            ]
        );

        return res.json({
            ok: true
        });
    } catch (e) {
        console.error('Executions error:', e.message);

        return res.status(500).json({
            error: '실행 기록을 저장할 수 없습니다.'
        });
    }
};