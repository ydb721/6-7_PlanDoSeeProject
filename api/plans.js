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
    const c = await db.getConnection();

    try {
        await c.beginTransaction();

        if (p.id) {
            const [[old]] = await c.query(
                `SELECT *
                 FROM plans
                 WHERE id = ?
                   AND user_id = ?`,
                [p.id, user.id]
            );

            if (!old) {
                await c.rollback();

                return res.status(404).json({
                    error: '계획을 찾을 수 없습니다.'
                });
            }

            await c.query(
                `INSERT INTO plan_history
                    (plan_id, title, start_date, end_date, priority, success_criteria, estimated_minutes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    old.id,
                    old.title,
                    old.start_date,
                    old.end_date,
                    old.priority,
                    old.success_criteria,
                    old.estimated_minutes
                ]
            );

            await c.query(
                `UPDATE plans
                 SET title = ?,
                     start_date = ?,
                     end_date = ?,
                     priority = ?,
                     success_criteria = ?,
                     estimated_minutes = ?
                 WHERE id = ?
                   AND user_id = ?`,
                [
                    p.title,
                    p.start_date,
                    p.end_date,
                    p.priority,
                    p.success_criteria,
                    p.estimated_minutes,
                    p.id,
                    user.id
                ]
            );
        } else {
            await c.query(
                `INSERT INTO plans
                    (user_id, title, start_date, end_date, priority, success_criteria, estimated_minutes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    user.id,
                    p.title,
                    p.start_date,
                    p.end_date,
                    p.priority,
                    p.success_criteria,
                    p.estimated_minutes
                ]
            );
        }

        await c.commit();

        return res.json({
            ok: true
        });
    } catch (e) {
        await c.rollback();

        console.error('Plans error:', e.message);

        return res.status(500).json({
            error: '계획을 저장할 수 없습니다.'
        });
    } finally {
        c.release();
    }
};