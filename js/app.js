const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)]; let state = { plans: [], tasks: [], executions: [], history: [], improvements: [] };
async function api(path, options = {}) { const r = await fetch('/api' + path, { headers: { 'Content-Type': 'application/json' }, ...options }); if (!r.ok) throw new Error(await r.text()); return r.json() }
function displayDate(v = '') {
    if (!v) return '';
    return String(v).replace(/^(\d{4})-(\d{2})-(\d{2})/, '$1.$2.$3');
}

function esc(v = '') { return String(v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])) }
$$('nav button').forEach(b => b.onclick = () => { $$('nav button').forEach(x => x.classList.remove('active')); $$('.page').forEach(x => x.classList.remove('active')); b.classList.add('active'); $('#' + b.dataset.page + 'Page').classList.add('active'); render() });
async function load() { state = await api('/data'); render() }
function options() { let o = '<option value="">Plan 선택</option>' + state.plans.map(p => `<option value="${p.id}">${esc(p.title)}</option>`).join(''); $('#taskPlan').innerHTML = o; $('#executionTask').innerHTML = '<option value="">선택하세요</option>' + state.tasks.filter(t => !t.deleted).map(t => `<option value="${t.id}">${esc(t.content)}</option>`).join('') }
function render() {
    options(); $('#planList').innerHTML = state.plans.map(p => `<div><b>${esc(p.title)}</b><p>${displayDate(p.start_date)} ~ ${displayDate(p.end_date)} · ${p.priority} · ${p.estimated_minutes}분</p><p>${esc(p.success_criteria)}
</p><button onclick="editPlan(${p.id})">수정</button></div>`).join('') || ''; $('#historyList').innerHTML = state.history.map(h => `<div><b>${esc(h.title)}</b><p>${displayDate(h.start_date)} ~ ${displayDate(h.end_date)} · ${h.priority} · ${h.estimated_minutes}분</p><small>${displayDate(h.created_at)}</small></div>`).join('') || ''; renderTasks(); $('#executionList').innerHTML = state.executions.map(e => `<div><b>${esc(e.task_content)}</b><p>${displayDate(e.started_at)} → ${displayDate(e.ended_at)} · ${e.actual_minutes}분</p><p>막힘: ${esc(e.blocked_reason || '')}</p></div>`).join('') || ''; review(); $('#improvementList').innerHTML = state.improvements.map(i => `<div>${esc(i.content)}</div>`).join('') || ''
}
function renderTasks() { let q = $('#search').value.toLowerCase(), f = $('#statusFilter').value, arr = state.tasks.filter(t => !t.deleted && t.content.toLowerCase().includes(q)); let today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); arr = arr.filter(t => f === 'ALL' || (f === 'OVERDUE' ? !t.completed && t.due_date < today : f === 'DONE' ? t.completed : !t.completed)); arr.sort((a, b) => $('#sort').value === 'priority' ? ({ HIGH: 0, MEDIUM: 1, LOW: 2 }[a.priority] - { HIGH: 0, MEDIUM: 1, LOW: 2 }[b.priority] || a.id - b.id) : a.due_date.localeCompare(b.due_date) || a.id - b.id); $('#taskList').innerHTML = arr.map(t => `<div><b>${esc(t.content)}</b> <span class="tag">${esc(t.tag || '태그 없음')}</span><p>${displayDate(t.due_date)} · ${t.priority} · ${t.estimated_minutes}분 · ${t.completed ? '완료' : '진행 중'}</p><div class="actions"><button onclick="toggleTask(${t.id})">${t.completed ? '진행 중으로' : '완료'}</button><button class="muted" onclick="editTask(${t.id})">수정</button><button class="danger task-minus-button" onclick="deleteTask(${t.id})" aria-label="할 일 삭제" title="삭제">−</button></div></div>`).join('') || '<p class="empty-message">조건에 맞는 할 일이 없습니다.</p>' }
$('#search').oninput = renderTasks; $('#statusFilter').onchange = renderTasks; $('#sort').onchange = renderTasks;
$('#planForm').onsubmit = async e => { e.preventDefault(); await api('/plans', { method: 'POST', body: JSON.stringify({ id: $('#planForm').dataset.id || null, title: $('#planTitle').value, start_date: $('#planStart').value, end_date: $('#planEnd').value, priority: $('#planPriority').value, estimated_minutes: +$('#planMinutes').value, success_criteria: $('#planCriteria').value }) }); e.target.reset(); delete e.target.dataset.id; await load() };
window.editPlan = id => { let p = state.plans.find(x => x.id === id); $('#planForm').dataset.id = id; $('#planTitle').value = p.title; $('#planStart').value = p.start_date; $('#planEnd').value = p.end_date; $('#planPriority').value = p.priority; $('#planMinutes').value = p.estimated_minutes; $('#planCriteria').value = p.success_criteria; scrollTo(0, 0) };
$('#taskForm').onsubmit = async e => { e.preventDefault(); await api('/tasks', { method: 'POST', body: JSON.stringify({ id: e.target.dataset.id || null, plan_id: +$('#taskPlan').value, content: $('#taskContent').value, due_date: $('#taskDue').value, priority: $('#taskPriority').value, tag: $('#taskTag').value, estimated_minutes: +$('#taskMinutes').value }) }); e.target.reset(); delete e.target.dataset.id; await load() };
window.editTask = id => { let t = state.tasks.find(x => x.id === id); $('#taskForm').dataset.id = id; $('#taskPlan').value = t.plan_id; $('#taskContent').value = t.content; $('#taskDue').value = t.due_date; $('#taskPriority').value = t.priority; $('#taskTag').value = t.tag || ''; $('#taskMinutes').value = t.estimated_minutes };
window.toggleTask = async id => { await api('/tasks/toggle', { method: 'POST', body: JSON.stringify({ id }) }); await load() };

window.deleteTask = async id => {
    await api('/tasks/delete', {
        method: 'POST',
        body: JSON.stringify({ id })
    });

    await load();
};
$('#executionForm').onsubmit = async e => { e.preventDefault(); await api('/executions', { method: 'POST', body: JSON.stringify({ task_id: +$('#executionTask').value, started_at: $('#executionStart').value, ended_at: $('#executionEnd').value, blocked_reason: $('#blockedReason').value }) }); e.target.reset(); await load() };
function review() { let tasks = state.tasks.filter(t => !t.deleted), today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }), done = tasks.filter(t => t.completed), over = tasks.filter(t => !t.completed && t.due_date < today), blocked = tasks.filter(t => state.executions.some(e => e.task_id === t.id && e.blocked_reason)), est = tasks.reduce((s, t) => s + t.estimated_minutes, 0), act = state.executions.reduce((s, e) => s + e.actual_minutes, 0); $('#total').textContent = tasks.length; $('#done').textContent = done.length; $('#overdue').textContent = over.length; $('#blocked').textContent = blocked.length; $('#estimated').textContent = est + '분'; $('#actual').textContent = act + '분'; $('#diff').textContent = (act - est) + '분' }
$$('[data-evidence]').forEach(b => b.onclick = () => {
    let k = b.dataset.evidence;
    let t = state.tasks.filter(x => !x.deleted);
    let today = new Date().toLocaleDateString('sv-SE', {
        timeZone: 'Asia/Seoul'
    });

    if (k === 'done') {
        t = t.filter(x => x.completed);
    }

    if (k === 'overdue') {
        t = t.filter(x => !x.completed && x.due_date < today);
    }

    if (k === 'blocked') {
        t = t.filter(x =>
            state.executions.some(e =>
                e.task_id === x.id && e.blocked_reason
            )
        );
    }

    const evidence = $('#evidence');

    /* 이게 빠져 있었음 */
    evidence.hidden = false;

    evidence.innerHTML =
        t.map(x => `<div>${esc(x.content)}</div>`).join('')
        || '<p>해당 기록이 없습니다.</p>';
}); $('#improvementForm').onsubmit = async e => { e.preventDefault(); await api('/improvements', { method: 'POST', body: JSON.stringify({ content: $('#improvement').value }) }); e.target.reset(); await load() }; $('#exportButton').onclick = () => location.href = '/api/export'; load().catch(e => console.warn('API/DB 연결 실패:', e.message));

const filterToggle = $('#filterToggle'), filterMenu = $('#filterMenu');
if (filterToggle) filterToggle.onclick = e => {
    e.stopPropagation();
    filterMenu.hidden = !filterMenu.hidden;
};
document.addEventListener('click', e => {
    if (filterMenu && !e.target.closest('.filter-wrap')) filterMenu.hidden = true;
});


const pageTitleMap = {
    plan: '계획 세우기',
    tasks: '할 일',
    do: '실제로 한 일',
    see: '돌아보기'
};
$$('nav button').forEach(button => {
    button.addEventListener('click', () => {
        const title = $('#currentPageTitle');
        if (title) title.textContent = pageTitleMap[button.dataset.page] || '';
    });
});
function formatDisplayDate(value) {
    if (!value) return '';
    return value.replaceAll('-', '.');
}

document.querySelectorAll('.calendar-btn').forEach(button => {
    button.addEventListener('click', () => {
        const dateInput =
            document.getElementById(button.dataset.calendar);

        if (dateInput.showPicker) {
            dateInput.showPicker();
        } else {
            dateInput.click();
        }
    });
});

['planStart', 'planEnd', 'taskDue'].forEach(id => {
    const dateInput = document.getElementById(id);
    const displayInput =
        document.getElementById(id + 'Display');

    dateInput.addEventListener('change', () => {
        displayInput.value =
            formatDisplayDate(dateInput.value);
    });
});

function formatDisplayDateTime(value) {
    if (!value) return '';

    const [date, time] = value.split('T');

    return `${date.replaceAll('-', '.')} ${time}`;
}

document.querySelectorAll('[data-datetime]').forEach(button => {
    button.addEventListener('click', () => {
        const input =
            document.getElementById(button.dataset.datetime);

        if (input.showPicker) {
            input.showPicker();
        } else {
            input.click();
        }
    });
});

['executionStart', 'executionEnd'].forEach(id => {
    const input = document.getElementById(id);
    const display =
        document.getElementById(id + 'Display');

    input.addEventListener('change', () => {
        display.value =
            formatDisplayDateTime(input.value);
    });
});