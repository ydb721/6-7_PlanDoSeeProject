const $ = s => document.querySelector(s),
    $$ = s => [...document.querySelectorAll(s)];

let state = {
    plans: [],
    tasks: [],
    executions: [],
    history: [],
    improvements: []
};

async function api(path, options = {}) {
    const r = await fetch('/api' + path, {
        headers: {
            'Content-Type': 'application/json'
        },
        ...options
    });

    if (!r.ok) {
        throw new Error(await r.text());
    }

    return r.json();
}


// ============================================================
// T07 인증 화면 전환
// ============================================================

const loginTab = $('#loginTab');
const registerTab = $('#registerTab');
const loginForm = $('#loginForm');
const registerForm = $('#registerForm');
const authMessage = $('#authMessage');

loginTab.onclick = () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');

    loginForm.hidden = false;
    registerForm.hidden = true;

    authMessage.textContent = '';
};

registerTab.onclick = () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');

    registerForm.hidden = false;
    loginForm.hidden = true;

    authMessage.textContent = '';
    authMessage.classList.remove('success');
};


// ============================================================
// 회원가입
// ============================================================

registerForm.onsubmit = async e => {
    e.preventDefault();

    authMessage.textContent = '';
    authMessage.classList.remove('success');

    try {
        const result = await api('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                username: $('#registerUsername').value.trim(),
                password: $('#registerPassword').value
            })
        });

        registerForm.reset();

        loginTab.click();

        $('#loginUsername').value = result.user.username;

        authMessage.classList.add('success');
        authMessage.textContent =
            '✓ 가입이 완료되었습니다. 이제 로그인해주세요.';
    } catch (error) {
        try {
            const data = JSON.parse(error.message);

            authMessage.textContent =
                data.error || '가입할 수 없습니다.';
        } catch {
            authMessage.textContent =
                '가입할 수 없습니다.';
        }
    }
};


// ============================================================
// 로그인
// ============================================================

loginForm.onsubmit = async e => {
    e.preventDefault();

    authMessage.textContent = '';

    try {
        const result = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                username: $('#loginUsername').value.trim(),
                password: $('#loginPassword').value
            })
        });

        authMessage.textContent = '';

        loginForm.reset();

        document.body.classList.remove('auth-locked');

        $('#currentUsername').textContent =
            result.user.username + ' 님';

        await load();
    } catch (error) {
        try {
            const data = JSON.parse(error.message);

            authMessage.textContent =
                data.error ||
                '아이디 또는 비밀번호가 올바르지 않습니다.';
        } catch {
            authMessage.textContent =
                '아이디 또는 비밀번호가 올바르지 않습니다.';
        }
    }
};


// ============================================================
// 공통
// ============================================================

function displayDate(v = '') {
    if (!v) return '';

    return String(v).replace(
        /^(\d{4})-(\d{2})-(\d{2})/,
        '$1.$2.$3'
    );
}

function esc(v = '') {
    return String(v).replace(
        /[&<>'"]/g,
        c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[c])
    );
}


// ============================================================
// 메뉴
// ============================================================

$$('nav button').forEach(b => {
    b.onclick = () => {
        $$('nav button').forEach(x =>
            x.classList.remove('active')
        );

        $$('.page').forEach(x =>
            x.classList.remove('active')
        );

        b.classList.add('active');

        $('#' + b.dataset.page + 'Page')
            .classList.add('active');

        render();
    };
});


// ============================================================
// 데이터
// ============================================================

async function load() {
    state = await api('/data');
    render();
}

function options() {
    let o =
        '<option value="">Plan 선택</option>' +
        state.plans
            .map(
                p =>
                    `<option value="${p.id}">${esc(p.title)}</option>`
            )
            .join('');

    $('#taskPlan').innerHTML = o;

    $('#executionTask').innerHTML =
        '<option value="">선택하세요</option>' +
        state.tasks
            .filter(t => !t.deleted)
            .map(
                t =>
                    `<option value="${t.id}">${esc(t.content)}</option>`
            )
            .join('');
}


// ============================================================
// 화면 렌더링
// ============================================================

function render() {
    options();

    $('#planList').innerHTML =
        state.plans
            .map(
                p => `
                <div>
                    <b>${esc(p.title)}</b>
                    <p>
                        ${displayDate(p.start_date)}
                        ~
                        ${displayDate(p.end_date)}
                        · ${p.priority}
                        · ${p.estimated_minutes}분
                    </p>
                    <p>${esc(p.success_criteria)}</p>
                    <button onclick="editPlan(${p.id})">
                        수정
                    </button>
                </div>
                `
            )
            .join('') || '';

    $('#historyList').innerHTML =
        state.history
            .map(
                h => `
                <div>
                    <b>${esc(h.title)}</b>
                    <p>
                        ${displayDate(h.start_date)}
                        ~
                        ${displayDate(h.end_date)}
                        · ${h.priority}
                        · ${h.estimated_minutes}분
                    </p>
                    <small>
                        ${displayDate(h.created_at)}
                    </small>
                </div>
                `
            )
            .join('') || '';

    renderTasks();

    $('#executionList').innerHTML =
        state.executions
            .map(
                e => `
                <div>
                    <b>${esc(e.task_content)}</b>
                    <p>
                        ${displayDate(e.started_at)}
                        →
                        ${displayDate(e.ended_at)}
                        · ${e.actual_minutes}분
                    </p>
                    <p>
                        막힘: ${esc(e.blocked_reason || '')}
                    </p>
                </div>
                `
            )
            .join('') || '';

    review();

    $('#improvementList').innerHTML =
        state.improvements
            .map(
                i => `<div>${esc(i.content)}</div>`
            )
            .join('') || '';
}


// ============================================================
// Tasks
// ============================================================

function renderTasks() {
    let q = $('#search').value.toLowerCase();
    let f = $('#statusFilter').value;

    let arr = state.tasks.filter(
        t =>
            !t.deleted &&
            t.content.toLowerCase().includes(q)
    );

    let today = new Date().toLocaleDateString(
        'sv-SE',
        {
            timeZone: 'Asia/Seoul'
        }
    );

    arr = arr.filter(t =>
        f === 'ALL'
            ? true
            : f === 'OVERDUE'
                ? !t.completed && t.due_date < today
                : f === 'DONE'
                    ? t.completed
                    : !t.completed
    );

    arr.sort((a, b) =>
        $('#sort').value === 'priority'
            ? (
                {
                    HIGH: 0,
                    MEDIUM: 1,
                    LOW: 2
                }[a.priority] -
                {
                    HIGH: 0,
                    MEDIUM: 1,
                    LOW: 2
                }[b.priority]
            ) || a.id - b.id
            : a.due_date.localeCompare(b.due_date) ||
              a.id - b.id
    );

    $('#taskList').innerHTML =
        arr
            .map(
                t => `
                <div>
                    <b>${esc(t.content)}</b>

                    <span class="tag">
                        ${esc(t.tag || '태그 없음')}
                    </span>

                    <p>
                        ${displayDate(t.due_date)}
                        · ${t.priority}
                        · ${t.estimated_minutes}분
                        · ${t.completed ? '완료' : '진행 중'}
                    </p>

                    <div class="actions">
                        <button onclick="toggleTask(${t.id})">
                            ${t.completed ? '진행 중으로' : '완료'}
                        </button>

                        <button
                            class="muted"
                            onclick="editTask(${t.id})"
                        >
                            수정
                        </button>

                        <button
                            class="danger task-minus-button"
                            onclick="deleteTask(${t.id})"
                            aria-label="할 일 삭제"
                            title="삭제"
                        >
                            −
                        </button>
                    </div>
                </div>
                `
            )
            .join('') ||
        '<p class="empty-message">조건에 맞는 할 일이 없습니다.</p>';
}

$('#search').oninput = renderTasks;
$('#statusFilter').onchange = renderTasks;
$('#sort').onchange = renderTasks;


// ============================================================
// Plan 저장 / 수정
// ============================================================

$('#planForm').onsubmit = async e => {
    e.preventDefault();

    await api('/plans', {
        method: 'POST',
        body: JSON.stringify({
            id: $('#planForm').dataset.id || null,
            title: $('#planTitle').value,
            start_date: $('#planStart').value,
            end_date: $('#planEnd').value,
            priority: $('#planPriority').value,
            estimated_minutes: +$('#planMinutes').value,
            success_criteria: $('#planCriteria').value
        })
    });

    e.target.reset();

    delete e.target.dataset.id;

    await load();
};

window.editPlan = id => {
    let p = state.plans.find(x => x.id === id);

    $('#planForm').dataset.id = id;
    $('#planTitle').value = p.title;
    $('#planStart').value = p.start_date;
    $('#planEnd').value = p.end_date;
    $('#planPriority').value = p.priority;
    $('#planMinutes').value = p.estimated_minutes;
    $('#planCriteria').value = p.success_criteria;

    scrollTo(0, 0);
};


// ============================================================
// Task 저장 / 수정
// ============================================================

$('#taskForm').onsubmit = async e => {
    e.preventDefault();

    await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
            id: e.target.dataset.id || null,
            plan_id: +$('#taskPlan').value,
            content: $('#taskContent').value,
            due_date: $('#taskDue').value,
            priority: $('#taskPriority').value,
            tag: $('#taskTag').value,
            estimated_minutes: +$('#taskMinutes').value
        })
    });

    e.target.reset();

    delete e.target.dataset.id;

    await load();
};

window.editTask = id => {
    let t = state.tasks.find(x => x.id === id);

    $('#taskForm').dataset.id = id;
    $('#taskPlan').value = t.plan_id;
    $('#taskContent').value = t.content;
    $('#taskDue').value = t.due_date;
    $('#taskPriority').value = t.priority;
    $('#taskTag').value = t.tag || '';
    $('#taskMinutes').value = t.estimated_minutes;
};

window.toggleTask = async id => {
    await api('/tasks/toggle', {
        method: 'POST',
        body: JSON.stringify({
            id
        })
    });

    await load();
};

window.deleteTask = async id => {
    await api('/tasks/delete', {
        method: 'POST',
        body: JSON.stringify({
            id
        })
    });

    await load();
};


// ============================================================
// Actual
// ============================================================

$('#executionForm').onsubmit = async e => {
    e.preventDefault();

    await api('/executions', {
        method: 'POST',
        body: JSON.stringify({
            task_id: +$('#executionTask').value,
            started_at: $('#executionStart').value,
            ended_at: $('#executionEnd').value,
            blocked_reason: $('#blockedReason').value
        })
    });

    e.target.reset();

    await load();
};


// ============================================================
// Review
// ============================================================

function review() {
    let tasks = state.tasks.filter(t => !t.deleted);

    let today = new Date().toLocaleDateString(
        'sv-SE',
        {
            timeZone: 'Asia/Seoul'
        }
    );

    let done =
        tasks.filter(t => t.completed);

    let over =
        tasks.filter(
            t =>
                !t.completed &&
                t.due_date < today
        );

    let blocked =
        tasks.filter(t =>
            state.executions.some(
                e =>
                    e.task_id === t.id &&
                    e.blocked_reason
            )
        );

    let est =
        tasks.reduce(
            (s, t) =>
                s + t.estimated_minutes,
            0
        );

    let act =
        state.executions.reduce(
            (s, e) =>
                s + e.actual_minutes,
            0
        );

    $('#total').textContent =
        tasks.length;

    $('#done').textContent =
        done.length;

    $('#overdue').textContent =
        over.length;

    $('#blocked').textContent =
        blocked.length;

    $('#estimated').textContent =
        est + '분';

    $('#actual').textContent =
        act + '분';

    $('#diff').textContent =
        (act - est) + '분';
}


// ============================================================
// Review 근거 보기
// ============================================================

$$('[data-evidence]').forEach(b => {
    b.onclick = () => {
        let k = b.dataset.evidence;

        let t =
            state.tasks.filter(
                x => !x.deleted
            );

        let today =
            new Date().toLocaleDateString(
                'sv-SE',
                {
                    timeZone: 'Asia/Seoul'
                }
            );

        if (k === 'done') {
            t = t.filter(
                x => x.completed
            );
        }

        if (k === 'overdue') {
            t = t.filter(
                x =>
                    !x.completed &&
                    x.due_date < today
            );
        }

        if (k === 'blocked') {
            t = t.filter(
                x =>
                    state.executions.some(
                        e =>
                            e.task_id === x.id &&
                            e.blocked_reason
                    )
            );
        }

        const evidence = $('#evidence');

        evidence.hidden = false;

        evidence.innerHTML =
            t
                .map(
                    x =>
                        `<div>${esc(x.content)}</div>`
                )
                .join('') ||
            '<p>해당 기록이 없습니다.</p>';
    };
});

$('#improvementForm').onsubmit = async e => {
    e.preventDefault();

    await api('/improvements', {
        method: 'POST',
        body: JSON.stringify({
            content: $('#improvement').value
        })
    });

    e.target.reset();

    await load();
};


// ============================================================
// T07 비밀번호 모달
// ============================================================

const passwordModal =
    $('#passwordModal');

const passwordModalForm =
    $('#passwordModalForm');

const passwordModalTitle =
    $('#passwordModalTitle');

const passwordModalDescription =
    $('#passwordModalDescription');

const passwordModalCurrent =
    $('#passwordModalCurrent');

const passwordModalNew =
    $('#passwordModalNew');

const passwordModalConfirm =
    $('#passwordModalConfirm');

const passwordModalMessage =
    $('#passwordModalMessage');

const passwordModalSubmit =
    $('#passwordModalSubmit');

let passwordModalMode = null;

function closePasswordModal() {
    passwordModal.hidden = true;

    passwordModalMode = null;

    passwordModalForm.reset();

    passwordModalMessage.textContent = '';
}

$('#passwordModalCancel').onclick =
    closePasswordModal;


// ============================================================
// 비밀번호 변경
// ============================================================

$('#changePasswordButton').onclick = () => {
    passwordModalMode = 'change';

    passwordModalTitle.textContent =
        '비밀번호 변경';

    passwordModalDescription.textContent =
        '현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다. 변경 후 다시 로그인해야 합니다.';

    passwordModalCurrent.hidden = false;
    passwordModalNew.hidden = false;
    passwordModalConfirm.hidden = false;

    passwordModalSubmit.textContent =
        '변경';

    passwordModalMessage.textContent = '';

    passwordModalForm.reset();

    passwordModal.hidden = false;

    passwordModalCurrent.focus();
};


// ============================================================
// 계정 삭제
// ============================================================

$('#deleteAccountButton').onclick = () => {
    passwordModalMode = 'delete';

    passwordModalTitle.textContent =
        '계정 삭제';

    passwordModalDescription.textContent =
        '계정을 삭제하면 Plan, Task, Actual, Review 등 연결된 모든 데이터가 삭제되며 되돌릴 수 없습니다. 현재 비밀번호를 입력해 삭제를 확인하세요.';

    passwordModalCurrent.hidden = false;
    passwordModalNew.hidden = true;
    passwordModalConfirm.hidden = true;

    passwordModalSubmit.textContent =
        '계정 삭제';

    passwordModalMessage.textContent = '';

    passwordModalForm.reset();

    passwordModal.hidden = false;

    passwordModalCurrent.focus();
};


// ============================================================
// 비밀번호 모달 제출
// ============================================================

passwordModalForm.onsubmit = async e => {
    e.preventDefault();

    passwordModalMessage.textContent = '';

    // 비밀번호 변경
    if (passwordModalMode === 'change') {
        const currentPassword =
            passwordModalCurrent.value;

        const newPassword =
            passwordModalNew.value;

        const newPasswordConfirm =
            passwordModalConfirm.value;

        if (
            !currentPassword ||
            !newPassword ||
            !newPasswordConfirm
        ) {
            passwordModalMessage.textContent =
                '모든 비밀번호를 입력해주세요.';

            return;
        }

        if (newPassword.length < 8) {
            passwordModalMessage.textContent =
                '새 비밀번호는 8자 이상이어야 합니다.';

            return;
        }

        if (
            newPassword !==
            newPasswordConfirm
        ) {
            passwordModalMessage.textContent =
                '새 비밀번호가 서로 일치하지 않습니다.';

            return;
        }

        try {
            const result =
                await api(
                    '/auth/change-password',
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            currentPassword,
                            newPassword
                        })
                    }
                );

            closePasswordModal();

            alert(result.message);

            state = {
                plans: [],
                tasks: [],
                executions: [],
                history: [],
                improvements: []
            };

            $('#currentUsername').textContent = '';

            document.body.classList.add(
                'auth-locked'
            );

            loginForm.reset();
            registerForm.reset();

            loginTab.click();
        } catch (error) {
            try {
                const data =
                    JSON.parse(
                        error.message
                    );

                passwordModalMessage.textContent =
                    data.error ||
                    '비밀번호를 변경할 수 없습니다.';
            } catch {
                passwordModalMessage.textContent =
                    '비밀번호를 변경할 수 없습니다.';
            }
        }

        return;
    }

    // 계정 삭제
    if (passwordModalMode === 'delete') {
        const password =
            passwordModalCurrent.value;

        if (!password) {
            passwordModalMessage.textContent =
                '현재 비밀번호를 입력해주세요.';

            return;
        }

        const confirmed = confirm(
            '계정과 연결된 모든 데이터가 영구적으로 삭제됩니다.\n정말 삭제할까요?'
        );

        if (!confirmed) {
            return;
        }

        try {
            const result =
                await api(
                    '/auth/delete-account',
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            password
                        })
                    }
                );

            closePasswordModal();

            alert(result.message);

            state = {
                plans: [],
                tasks: [],
                executions: [],
                history: [],
                improvements: []
            };

            $('#currentUsername').textContent = '';

            document.body.classList.add(
                'auth-locked'
            );

            loginForm.reset();
            registerForm.reset();

            loginTab.click();
        } catch (error) {
            try {
                const data =
                    JSON.parse(
                        error.message
                    );

                passwordModalMessage.textContent =
                    data.error ||
                    '계정을 삭제할 수 없습니다.';
            } catch {
                passwordModalMessage.textContent =
                    '계정을 삭제할 수 없습니다.';
            }
        }
    }
};


// ============================================================
// 내보내기
// ============================================================

$('#exportButton').onclick = () =>
    location.href = '/api/export';


// ============================================================
// 로그아웃
// ============================================================

$('#logoutButton').onclick = async () => {
    try {
        await api('/auth/logout', {
            method: 'POST'
        });

        state = {
            plans: [],
            tasks: [],
            executions: [],
            history: [],
            improvements: []
        };

        document.body.classList.add(
            'auth-locked'
        );

        $('#currentUsername').textContent = '';

        loginForm.reset();
        registerForm.reset();

        authMessage.textContent = '';

        authMessage.classList.remove(
            'success'
        );

        loginTab.click();
    } catch (error) {
        alert('로그아웃할 수 없습니다.');
    }
};


// ============================================================
// 현재 로그인 확인
// ============================================================

async function checkAuth() {
    try {
        const result =
            await api('/auth/me');

        document.body.classList.remove(
            'auth-locked'
        );

        $('#currentUsername').textContent =
            result.user.username + ' 님';

        await load();
    } catch (error) {
        $('#currentUsername').textContent = '';

        document.body.classList.add(
            'auth-locked'
        );
    }
}

checkAuth();


// ============================================================
// 필터
// ============================================================

const filterToggle =
    $('#filterToggle');

const filterMenu =
    $('#filterMenu');

if (filterToggle) {
    filterToggle.onclick = e => {
        e.stopPropagation();

        filterMenu.hidden =
            !filterMenu.hidden;
    };
}

document.addEventListener(
    'click',
    e => {
        if (
            filterMenu &&
            !e.target.closest('.filter-wrap')
        ) {
            filterMenu.hidden = true;
        }
    }
);


// ============================================================
// 페이지 제목
// ============================================================

const pageTitleMap = {
    plan: '계획 세우기',
    tasks: '할 일',
    do: '실제로 한 일',
    see: '돌아보기'
};

$$('nav button').forEach(button => {
    button.addEventListener(
        'click',
        () => {
            const title =
                $('#currentPageTitle');

            if (title) {
                title.textContent =
                    pageTitleMap[
                        button.dataset.page
                    ] || '';
            }
        }
    );
});


// ============================================================
// 날짜 표시
// ============================================================

function formatDisplayDate(value) {
    if (!value) return '';

    return value.replaceAll(
        '-',
        '.'
    );
}

document
    .querySelectorAll('.calendar-btn')
    .forEach(button => {
        button.addEventListener(
            'click',
            () => {
                const dateInput =
                    document.getElementById(
                        button.dataset.calendar
                    );

                if (dateInput.showPicker) {
                    dateInput.showPicker();
                } else {
                    dateInput.click();
                }
            }
        );
    });

[
    'planStart',
    'planEnd',
    'taskDue'
].forEach(id => {
    const dateInput =
        document.getElementById(id);

    const displayInput =
        document.getElementById(
            id + 'Display'
        );

    dateInput.addEventListener(
        'change',
        () => {
            displayInput.value =
                formatDisplayDate(
                    dateInput.value
                );
        }
    );
});


// ============================================================
// 날짜 + 시간 표시
// ============================================================

function formatDisplayDateTime(value) {
    if (!value) return '';

    const [date, time] =
        value.split('T');

    return `${date.replaceAll('-', '.')} ${time}`;
}

document
    .querySelectorAll('[data-datetime]')
    .forEach(button => {
        button.addEventListener(
            'click',
            () => {
                const input =
                    document.getElementById(
                        button.dataset.datetime
                    );

                if (input.showPicker) {
                    input.showPicker();
                } else {
                    input.click();
                }
            }
        );
    });

[
    'executionStart',
    'executionEnd'
].forEach(id => {
    const input =
        document.getElementById(id);

    const display =
        document.getElementById(
            id + 'Display'
        );

    input.addEventListener(
        'change',
        () => {
            display.value =
                formatDisplayDateTime(
                    input.value
                );
        }
    );
});