const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('./_db');

const COOKIE_NAME = 'pds_session';

function getCookie(req, name) {
    const cookieHeader = req.headers.cookie || '';
    const cookies = cookieHeader.split(';').map(cookie => cookie.trim());

    for (const cookie of cookies) {
        const index = cookie.indexOf('=');
        if (index === -1) continue;

        const key = cookie.slice(0, index);
        const value = cookie.slice(index + 1);

        if (key === name) {
            return decodeURIComponent(value);
        }
    }

    return null;
}

function hashToken(token) {
    return crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
}

async function getCurrentUser(req) {
    const token = getCookie(req, COOKIE_NAME);

    if (!token) {
        return null;
    }

    const tokenHash = hashToken(token);

    const [rows] = await pool.query(
        `SELECT
            users.id,
            users.username,
            sessions.id AS session_id
         FROM sessions
         JOIN users
           ON users.id = sessions.user_id
         WHERE sessions.token_hash = ?
           AND sessions.expires_at > NOW()
         LIMIT 1`,
        [tokenHash]
    );

    return rows[0] || null;
}

async function requireAuth(req, res) {
    const user = await getCurrentUser(req);

    if (!user) {
        res.status(401).json({
            error: '로그인이 필요합니다.'
        });

        return null;
    }

    return user;
}

function setSessionCookie(res, token) {
    const secure = process.env.VERCEL
        ? '; Secure'
        : '';

    res.setHeader(
        'Set-Cookie',
        `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`
    );
}

function clearSessionCookie(res) {
    const secure = process.env.VERCEL
        ? '; Secure'
        : '';

    res.setHeader(
        'Set-Cookie',
        `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
    );
}


// ============================================================
// 회원가입
// ============================================================

async function register(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    const username =
        String(req.body?.username || '').trim();

    const password =
        String(req.body?.password || '');

    if (!username || !password) {
        return res.status(400).json({
            error: '아이디와 비밀번호를 입력해주세요.'
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            error: '비밀번호는 8자 이상이어야 합니다.'
        });
    }

    try {
        const [existing] = await pool.query(
            `SELECT id
             FROM users
             WHERE username = ?
             LIMIT 1`,
            [username]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                error: '이미 사용 중인 아이디입니다.'
            });
        }

        const passwordHash =
            await bcrypt.hash(password, 12);

        const [result] = await pool.query(
            `INSERT INTO users
                (username, password_hash)
             VALUES (?, ?)`,
            [username, passwordHash]
        );

        return res.status(201).json({
            ok: true,
            user: {
                id: result.insertId,
                username
            }
        });
    } catch (error) {
        console.error(
            'Register error:',
            error.message
        );

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: '이미 사용 중인 아이디입니다.'
            });
        }

        return res.status(500).json({
            error: '계정을 만들 수 없습니다.'
        });
    }
}


// ============================================================
// 로그인
// ============================================================

async function login(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    const username =
        String(req.body?.username || '').trim();

    const password =
        String(req.body?.password || '');

    const loginError = {
        error: '아이디 또는 비밀번호가 올바르지 않습니다.'
    };

    if (!username || !password) {
        return res.status(401).json(loginError);
    }

    try {
        const [rows] = await pool.query(
            `SELECT
                id,
                username,
                password_hash
             FROM users
             WHERE username = ?
             LIMIT 1`,
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json(loginError);
        }

        const user = rows[0];

        const passwordOk =
            await bcrypt.compare(
                password,
                user.password_hash
            );

        if (!passwordOk) {
            return res.status(401).json(loginError);
        }

        const token =
            crypto.randomBytes(32).toString('hex');

        const tokenHash =
            hashToken(token);

        await pool.query(
            `INSERT INTO sessions
                (user_id, token_hash, expires_at)
             VALUES (
                ?,
                ?,
                DATE_ADD(NOW(), INTERVAL 7 DAY)
             )`,
            [user.id, tokenHash]
        );

        setSessionCookie(res, token);

        return res.status(200).json({
            ok: true,
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error(
            'Login error:',
            error.message
        );

        return res.status(500).json({
            error: '로그인할 수 없습니다.'
        });
    }
}


// ============================================================
// 로그아웃
// ============================================================

async function logout(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    try {
        const token =
            getCookie(req, COOKIE_NAME);

        if (token) {
            const tokenHash =
                hashToken(token);

            await pool.query(
                `DELETE FROM sessions
                 WHERE token_hash = ?`,
                [tokenHash]
            );
        }

        clearSessionCookie(res);

        return res.status(200).json({
            ok: true
        });
    } catch (error) {
        console.error(
            'Logout error:',
            error.message
        );

        return res.status(500).json({
            error: '로그아웃할 수 없습니다.'
        });
    }
}


// ============================================================
// 현재 로그인 사용자
// ============================================================

async function me(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    try {
        const user =
            await getCurrentUser(req);

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
        console.error(
            'Me error:',
            error.message
        );

        return res.status(500).json({
            error: '로그인 상태를 확인할 수 없습니다.'
        });
    }
}


// ============================================================
// 비밀번호 변경
// ============================================================

async function changePassword(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    const user =
        await requireAuth(req, res);

    if (!user) {
        return;
    }

    const currentPassword =
        String(req.body?.currentPassword || '');

    const newPassword =
        String(req.body?.newPassword || '');

    if (!currentPassword || !newPassword) {
        return res.status(400).json({
            error: '현재 비밀번호와 새 비밀번호를 입력해주세요.'
        });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({
            error: '새 비밀번호는 8자 이상이어야 합니다.'
        });
    }

    try {
        const [rows] = await pool.query(
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

        const passwordOk =
            await bcrypt.compare(
                currentPassword,
                rows[0].password_hash
            );

        if (!passwordOk) {
            return res.status(401).json({
                error: '현재 비밀번호가 올바르지 않습니다.'
            });
        }

        const newPasswordHash =
            await bcrypt.hash(newPassword, 12);

        const connection =
            await pool.getConnection();

        try {
            await connection.beginTransaction();

            await connection.query(
                `UPDATE users
                 SET password_hash = ?
                 WHERE id = ?`,
                [
                    newPasswordHash,
                    user.id
                ]
            );

            await connection.query(
                `DELETE FROM sessions
                 WHERE user_id = ?`,
                [user.id]
            );

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        clearSessionCookie(res);

        return res.status(200).json({
            ok: true,
            message:
                '비밀번호가 변경되었습니다. 다시 로그인해주세요.'
        });
    } catch (error) {
        console.error(
            'Change password error:',
            error.message
        );

        return res.status(500).json({
            error: '비밀번호를 변경할 수 없습니다.'
        });
    }
}


// ============================================================
// 계정 삭제
// ============================================================

async function deleteAccount(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    const user =
        await requireAuth(req, res);

    if (!user) {
        return;
    }

    const password =
        String(req.body?.password || '');

    if (!password) {
        return res.status(400).json({
            error: '현재 비밀번호를 입력해주세요.'
        });
    }

    try {
        const [rows] = await pool.query(
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

        const passwordOk =
            await bcrypt.compare(
                password,
                rows[0].password_hash
            );

        if (!passwordOk) {
            return res.status(401).json({
                error: '현재 비밀번호가 올바르지 않습니다.'
            });
        }

        const connection =
            await pool.getConnection();

        try {
            await connection.beginTransaction();

            await connection.query(
                `DELETE e
                 FROM executions e
                 JOIN tasks t
                   ON t.id = e.task_id
                 JOIN plans p
                   ON p.id = t.plan_id
                 WHERE p.user_id = ?`,
                [user.id]
            );

            await connection.query(
                `DELETE t
                 FROM tasks t
                 JOIN plans p
                   ON p.id = t.plan_id
                 WHERE p.user_id = ?`,
                [user.id]
            );

            await connection.query(
                `DELETE h
                 FROM plan_history h
                 JOIN plans p
                   ON p.id = h.plan_id
                 WHERE p.user_id = ?`,
                [user.id]
            );

            await connection.query(
                `DELETE FROM plans
                 WHERE user_id = ?`,
                [user.id]
            );

            await connection.query(
                `DELETE FROM improvements
                 WHERE user_id = ?`,
                [user.id]
            );

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
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        clearSessionCookie(res);

        return res.status(200).json({
            ok: true,
            message:
                '계정과 연결된 모든 데이터가 삭제되었습니다.'
        });
    } catch (error) {
        console.error(
            'Delete account error:',
            error.message
        );

        return res.status(500).json({
            error: '계정을 삭제할 수 없습니다.'
        });
    }
}


// ============================================================
// 요청 분기
// ============================================================

module.exports = async function handler(req, res) {
    const action =
        String(req.query?.action || '');

    switch (action) {
        case 'register':
            return register(req, res);

        case 'login':
            return login(req, res);

        case 'logout':
            return logout(req, res);

        case 'me':
            return me(req, res);

        case 'change-password':
            return changePassword(req, res);

        case 'delete-account':
            return deleteAccount(req, res);

        default:
            return res.status(404).json({
                error: '요청을 찾을 수 없습니다.'
            });
    }
};