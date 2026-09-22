const db = require('../_db');
const { requireAuth } = require('../auth/_auth');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    const user = await requireAuth(req, res);

    if (!user) {
        return;
    }

    try {
        const [[task]] = await db.query(
            `SELECT t.id
             FROM tasks t
             JOIN plans p ON p.id = t.plan_id
             WHERE t.id = ?
               AND t.deleted = 0
               AND p.user_id = ?`,
            [req.body.id, user.id]
        );

        if (!task) {
            return res.status(404).json({
                error: '할 일을 찾을 수 없습니다.'
            });
        }

        await db.query(
            `UPDATE tasks
             SET completed = NOT completed,
                 completed_at = IF(completed = 0, NOW(), NULL)
             WHERE id = ?
               AND deleted = 0`,
            [req.body.id]
        );

        return res.json({
            ok: true
        });
    } catch (e) {
        console.error('Task toggle error:', e.message);

        return res.status(500).json({
            error: '할 일 상태를 변경할 수 없습니다.'
        });
    }
};