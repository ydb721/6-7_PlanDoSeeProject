const db = require('./_db');
const { requireAuth } = require('./auth/_auth');

module.exports = async (req, res) => {
    try {
        const user = await requireAuth(req, res);

        if (!user) {
            return;
        }

        const [plans] = await db.query(
            `SELECT *
             FROM plans
             WHERE user_id = ?
             ORDER BY id DESC`,
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
            `SELECT e.*, t.content AS task_content
             FROM executions e
             JOIN tasks t ON t.id = e.task_id
             JOIN plans p ON p.id = t.plan_id
             WHERE p.user_id = ?
             ORDER BY e.id DESC`,
            [user.id]
        );

        const [history] = await db.query(
            `SELECT h.*
             FROM plan_history h
             JOIN plans p ON p.id = h.plan_id
             WHERE p.user_id = ?
             ORDER BY h.id DESC`,
            [user.id]
        );

        const [improvements] = await db.query(
            `SELECT *
             FROM improvements
             WHERE user_id = ?
             ORDER BY id DESC`,
            [user.id]
        );

        res.json({
            plans,
            tasks,
            executions,
            history,
            improvements
        });
    } catch (e) {
        console.error('Data error:', e.message);

        res.status(500).json({
            error: '데이터를 불러올 수 없습니다.'
        });
    }
};