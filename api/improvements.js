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

    try {
        await db.query(
            `INSERT INTO improvements
                (user_id, content)
             VALUES (?, ?)`,
            [
                user.id,
                req.body.content
            ]
        );

        return res.json({
            ok: true
        });
    } catch (e) {
        console.error('Improvements error:', e.message);

        return res.status(500).json({
            error: '회고를 저장할 수 없습니다.'
        });
    }
};