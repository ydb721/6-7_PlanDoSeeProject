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
        // 선택한 Plan이 현재 로그인한 사용자의 것인지 확인
        const [[plan]] = await db.query(
            `SELECT id
             FROM plans
             WHERE id = ?
               AND user_id = ?`,
            [p.plan_id, user.id]
        );

        if (!plan) {
            return res.status(404).json({
                error: '계획을 찾을 수 없습니다.'
            });
        }

        if (p.id) {
            // 수정하려는 Task도 현재 사용자의 것인지 확인
            const [[task]] = await db.query(
                `SELECT t.id
                 FROM tasks t
                 JOIN plans p ON p.id = t.plan_id
                 WHERE t.id = ?
                   AND p.user_id = ?`,
                [p.id, user.id]
            );

            if (!task) {
                return res.status(404).json({
                    error: '할 일을 찾을 수 없습니다.'
                });
            }

            await db.query(
                `UPDATE tasks
                 SET plan_id = ?,
                     content = ?,
                     due_date = ?,
                     priority = ?,
                     tag = ?,
                     estimated_minutes = ?
                 WHERE id = ?`,
                [
                    p.plan_id,
                    p.content,
                    p.due_date,
                    p.priority,
                    p.tag,
                    p.estimated_minutes,
                    p.id
                ]
            );
        } else {
            await db.query(
                `INSERT INTO tasks
                    (plan_id, content, due_date, priority, tag, estimated_minutes)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    p.plan_id,
                    p.content,
                    p.due_date,
                    p.priority,
                    p.tag,
                    p.estimated_minutes
                ]
            );
        }

        return res.json({
            ok: true
        });
    } catch (e) {
        console.error('Tasks error:', e.message);

        return res.status(500).json({
            error: '할 일을 저장할 수 없습니다.'
        });
    }
};