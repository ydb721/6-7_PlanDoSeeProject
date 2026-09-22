const { getCurrentUser } = require('./_auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = await getCurrentUser(req);

        if (!user) {
            return res.status(401).json({
                error: '로그인이 필요합니다.'
            });
        }

        return res.status(200).json({
            ok: true,
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Auth check error:', error.message);

        return res.status(500).json({
            error: '로그인 상태를 확인할 수 없습니다.'
        });
    }
};