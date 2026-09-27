const db = require('./_db');
const { requireAuth } = require('./auth/_auth');

module.exports = async (req, res) => {
    try {
        const user = await requireAuth(req, res);

        if (!user) {
            return;
        }

        // 특정 Plan 1건 조회
        // 예: /api/data?plan_id=3
        const requestedPlanId = Number(req.query?.plan_id || 0);

        if (requestedPlanId > 0) {
            const [[plan]] = await db.query(
                `SELECT *
                 FROM plans
                 WHERE id = ?
                   AND user_id = ?
                 LIMIT 1`,
                [requestedPlanId, user.id]
            );

            if (!plan) {
                return res.status(404).json({
                    error: '계획을 찾을 수 없습니다.'
                });
            }

            return res.json({
                plan
            });
        }

        // 전체 Plan 목록
        const [plans] = await db.query(
            `SELECT *
             FROM plans
             WHERE user_id = ?
             ORDER BY id DESC`,
            [user.id]
        );

        // 전체 Task 목록
        const [tasks] = await db.query(
            `SELECT t.*
             FROM tasks t
             JOIN plans p ON p.id = t.plan_id
             WHERE p.user_id = ?
             ORDER BY t.id`,
            [user.id]
        );

        // 전체 Actual 목록
        const [executions] = await db.query(
            `SELECT e.*, t.content AS task_content
             FROM executions e
             JOIN tasks t ON t.id = e.task_id
             JOIN plans p ON p.id = t.plan_id
             WHERE p.user_id = ?
             ORDER BY e.id DESC`,
            [user.id]
        );

        // Plan 수정 이력
        const [history] = await db.query(
            `SELECT h.*
             FROM plan_history h
             JOIN plans p ON p.id = h.plan_id
             WHERE p.user_id = ?
             ORDER BY h.id DESC`,
            [user.id]
        );

        // Review 목록
        const [improvements] = await db.query(
            `SELECT *
             FROM improvements
             WHERE user_id = ?
             ORDER BY id DESC`,
            [user.id]
        );

        return res.json({
            plans,
            tasks,
            executions,
            history,
            improvements
        });
    } catch (e) {
        console.error('Data error:', e.message);

        return res.status(500).json({
            error: '데이터를 불러올 수 없습니다.'
        });
    }
};