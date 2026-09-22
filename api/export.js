const db = require('./_db');
const { requireAuth } = require('./auth/_auth');

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).end();
    }

    const user = await requireAuth(req, res);

    if (!user) {
        return;
    }

    try {
        const [plans] = await db.query(
            `SELECT *
             FROM plans
             WHERE user_id = ?
             ORDER BY id`,
            [user.id]
        );

        const [history] = await db.query(
            `SELECT h.*
             FROM plan_history h
             JOIN plans p ON p.id = h.plan_id
             WHERE p.user_id = ?
             ORDER BY h.id`,
            [user.id]
        );

        const [tasks] = await db.query(
            `SELECT t.*
             FROM tasks t
             JOIN plans p ON p.id = t.plan_id
             WHERE p.user_id = ?
             ORDER BY t.id`,
            [user.id]
        );

        const [executions] = await db.query(
            `SELECT e.*
             FROM executions e
             JOIN tasks t ON t.id = e.task_id
             JOIN plans p ON p.id = t.plan_id
             WHERE p.user_id = ?
             ORDER BY e.id`,
            [user.id]
        );

        const [improvements] = await db.query(
            `SELECT *
             FROM improvements
             WHERE user_id = ?
             ORDER BY id`,
            [user.id]
        );

        const out = {
            exported_at: new Date().toISOString(),
            plans,
            plan_history: history,
            tasks,
            executions,
            improvements
        };

        res.setHeader(
            'Content-Disposition',
            'attachment; filename="pds-diary-export.json"'
        );

        res.setHeader(
            'Content-Type',
            'application/json; charset=utf-8'
        );

        return res.send(
            JSON.stringify(out, null, 2)
        );
    } catch (e) {
        console.error('Export error:', e.message);

        return res.status(500).json({
            error: '데이터를 내보낼 수 없습니다.'
        });
    }
};