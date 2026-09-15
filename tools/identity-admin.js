'use strict';
const $ = id => document.getElementById(id);
const esc = text => String(text ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
let state, pending, busy = false;
const selected = new Set();
const labels = { merge: '合并身份', move: '调整成绩归属', distinct: '确认不同人', undo: '撤销操作' };
const nameOf = id => state.view.byId[id]?.name || id;
function status(message, error = false) { $('status').textContent = message; $('status').className = error ? 'error' : ''; }
async function refresh() {
  const response = await fetch('/api/state');
  if (!response.ok) throw new Error('无法读取项目数据');
  state = await response.json(); selected.clear();
  $('counts').textContent = state.view.students.length + ' 个身份 · ' + state.candidates.length + ' 对待核对';
  fill('A'); fill('B'); renderCandidates(); renderPeople(); renderHistory();
}
function fill(side, choose) {
  const current = choose || $('person' + side).value;
  const keyword = $('search' + side).value.trim().toLowerCase();
  const list = state.view.students.filter(p => !keyword || [p.id,p.name,...p.school_history].join(' ').toLowerCase().includes(keyword) || p.id === choose);
  $('person' + side).innerHTML = '<option value="">请选择学生</option>' + list.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name + ' · ' + p.id + ' · ' + (p.high_school || p.middle_school || p.primary_school || p.school_history[0] || '学校待核对')) + '</option>').join('');
  if (list.some(p => p.id === current)) $('person' + side).value = current;
}
function renderCandidates() {
  const keyword = $('candidateSearch').value.trim();
  const pairs = state.candidates.filter(p => p.name.includes(keyword));
  $('candidates').innerHTML = pairs.length ? pairs.map(p => '<button class="candidate" data-from="' + esc(p.from) + '" data-to="' + esc(p.to) + '">' + esc(p.name) + '<small>' + esc(p.from + ' ↔ ' + p.to) + '</small></button>').join('') : '<p>没有待核对的同名候选。也可以手动查找学生。</p>';
}
function renderPeople() {
  for (const side of ['A', 'B']) {
    const id = $('person' + side).value, person = state.view.byId[id];
    const rows = state.view.rows.filter(r => r.student_id === id).sort((a,b) => Number(b.year)-Number(a.year) || String(a.contest).localeCompare(String(b.contest)) || Number(a.rank)-Number(b.rank));
    $('summary' + side).innerHTML = person ? '<strong>' + esc(person.name) + '</strong> · ' + esc(id) + '<p>' + rows.length + ' 条成绩 · ' + person.member_ids.length + ' 个原始身份</p>' + person.school_history.map(s => '<span class="badge">' + esc(s) + '</span>').join('') + '<p><a href="/hfoi-player-detail.html?sid=' + encodeURIComponent(id) + '" target="_blank" rel="noopener">预览公开详情</a></p>' : '<p>选择学生后查看学校和成绩。</p>';
    $('records' + side).innerHTML = rows.length ? rows.map(r => '<article class="record"><label>' + (side === 'A' ? '<input type="checkbox" data-record="' + esc(r.id) + '"' + (selected.has(r.id) ? ' checked' : '') + '>' : '') + '<span>' + esc(r.contest) + '</span></label><p>' + esc(r.school) + ' · ' + esc(r.award || '未标注奖项') + ' · 名次 ' + esc(r.rank ?? '—') + '</p><p>成绩 ' + esc(r.id) + ' · 原始姓名 ' + esc(r.original_name) + ' · 原始身份 ' + esc(r.original_student_id) + '</p>' + (r.source ? '<p>来源：' + esc(typeof r.source === 'string' ? r.source : JSON.stringify(r.source)) + '</p>' : '') + '</article>').join('') : '<p>暂无成绩。</p>';
  }
  $('selection').textContent = '已勾选 A 的 ' + selected.size + ' 条成绩。拆分只调整这些成绩，账号和成就仍留在原身份。';
}
function renderHistory() {
  const active = new Set(state.view.active.map(e => e.id));
  $('undo').disabled = !active.size;
  $('history').innerHTML = [...state.ledger.events].reverse().map(e => '<div class="event"><strong>' + labels[e.type] + '</strong> · ' + esc(e.at) + ' · ' + (e.type === 'undo' ? '已记录' : active.has(e.id) ? '生效中' : '已撤销') + '<p>' + esc(e.from ? e.from + ' → ' + (e.to || '') : '撤销 ' + e.target) + (e.record_ids ? ' · ' + e.record_ids.length + ' 条成绩' : '') + '</p><p>' + esc(e.reason) + '</p></div>').join('') || '<p>尚无身份调整。现有学生保持独立。</p>';
  $('decisions').innerHTML = state.view.distinct.map(d => '<p>' + esc(d.ids.map(id => nameOf(id) + ' (' + id + ')').join(' ≠ ')) + '：' + esc(d.reason) + '</p>').join('') || '<p>暂无记录。</p>';
}
function propose(type, split = false) {
  const reason = $('reason').value.trim(), from = $('personA').value, to = $('personB').value;
  if (!reason) return status('请先填写核对依据。', true);
  let action = { type, reason, from, to }, description;
  if (type === 'undo') {
    const last = state.view.active.at(-1);
    if (!last) return;
    action = { type, reason, target: last.id };
    description = '撤销最近的“' + labels[last.type] + '”，恢复该操作之前的身份归属。';
  } else {
    if (!from) return status('请选择原学生 A。', true);
    if (!split && (!to || from === to)) return status('请选择与 A 不同的目标学生 B。', true);
    if (type === 'move') {
      if (!selected.size) return status('请先勾选 A 的成绩。', true);
      action.record_ids = [...selected];
      if (split) {
        const name = $('newName').value.trim();
        if (!name) return status('请填写新学生姓名。', true);
        action.new_student = { name }; delete action.to;
      }
      description = '将 ' + nameOf(from) + ' (' + from + ') 的 ' + selected.size + ' 条勾选成绩转给 ' + (split ? '新学生“' + action.new_student.name + '”' : nameOf(to) + ' (' + to + ')') + '。账号和成就留在原身份。';
    } else description = type === 'merge' ? '将 ' + nameOf(from) + ' (' + from + ') 的全部成绩、账号和成就合并到 ' + nameOf(to) + ' (' + to + ')，保留目标姓名和展示学校。' : '确认 ' + nameOf(from) + ' (' + from + ') 与 ' + nameOf(to) + ' (' + to + ') 是不同人，从待核对候选中排除。';
  }
  pending = { revision: state.revision, action };
  $('confirmText').textContent = description; $('confirmReason').textContent = '依据：' + reason; $('confirm').showModal();
}
$('candidates').addEventListener('click', e => {
  const button = e.target.closest('[data-from]'); if (!button) return;
  $('searchA').value = ''; $('searchB').value = ''; selected.clear();
  fill('A', button.dataset.from); fill('B', button.dataset.to); renderPeople();
});
for (const side of ['A','B']) {
  $('search' + side).addEventListener('input', () => { fill(side); if (side === 'A') selected.clear(); renderPeople(); });
  $('person' + side).addEventListener('change', () => { if (side === 'A') selected.clear(); renderPeople(); });
}
$('recordsA').addEventListener('change', e => { const id = e.target.dataset.record; if (!id) return; e.target.checked ? selected.add(id) : selected.delete(id); $('selection').textContent = '已勾选 A 的 ' + selected.size + ' 条成绩。账号和成就仍留在原身份。'; });
$('candidateSearch').addEventListener('input', renderCandidates);
for (const type of ['merge','distinct','move','undo']) $(type).addEventListener('click', () => propose(type));
$('split').addEventListener('click', () => propose('move', true));
$('cancel').addEventListener('click', () => $('confirm').close());
$('save').addEventListener('click', async () => {
  if (busy) return; busy = true; $('save').disabled = true;
  try {
    const response = await fetch('/api/action', { method:'POST', headers:{'Content-Type':'application/json','X-Identity-Token':state.token}, body:JSON.stringify(pending) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    $('confirm').close(); $('reason').value = ''; await refresh(); status('已保存到本地项目。可预览结果，发布后公开网站才会更新。');
  } catch (error) { $('confirm').close(); status(error.message, true); }
  finally { busy = false; $('save').disabled = false; }
});
$('refresh').addEventListener('click', () => refresh().then(() => status('数据已刷新。')).catch(e => status(e.message,true)));
refresh().then(() => status('请选择一对候选，或手动查找需要拆分的学生。')).catch(e => status(e.message,true));
