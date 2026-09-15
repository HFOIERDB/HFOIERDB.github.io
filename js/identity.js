/* Shared by the public site, local maintenance server and tests. No name-based merging. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HFOIIdentity = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const schoolFields = ['primary_school', 'middle_school', 'high_school'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
  const pairKey = (a, b) => JSON.stringify([a, b].sort());

  function activeEvents(ledger) {
    requireValue(ledger && ledger.version === 1 && Array.isArray(ledger.events), '身份记录格式无效');
    const ids = new Set(), stack = [];
    for (const event of ledger.events) {
      requireValue(event.id && !ids.has(event.id), '操作 ID 缺失或重复');
      ids.add(event.id);
      requireValue(typeof event.reason === 'string' && event.reason.trim(), '每次操作必须填写核对依据');
      if (event.type === 'undo') {
        requireValue(stack.length && stack[stack.length - 1].id === event.target, '只能撤销最近一条仍生效的操作');
        stack.pop();
      } else {
        requireValue(['merge', 'move', 'distinct'].includes(event.type), '未知身份操作');
        stack.push(event);
      }
    }
    return stack;
  }

  function project(students, results, ledger) {
    const people = new Map(), records = new Map(), aliases = new Map(), distinct = new Map();
    for (const person of students) {
      requireValue(typeof person.id === 'string' && person.id && !people.has(person.id), '学生 ID 缺失或重复');
      requireValue(typeof person.name === 'string' && person.name.trim(), '学生姓名不能为空');
      people.set(person.id, { ...clone(person), member_ids: [person.id] });
    }
    for (const row of results) {
      requireValue(typeof row.id === 'string' && row.id && !records.has(row.id), '成绩 ID 缺失或重复');
      requireValue(people.has(row.student_id), '成绩引用不存在的学生：' + row.id);
      records.set(row.id, { ...clone(row), original_student_id: row.student_id });
    }
    const active = activeEvents(ledger);
    const resolve = id => { while (aliases.has(id)) id = aliases.get(id); return id; };
    for (const event of active) {
      if (event.type === 'merge' || event.type === 'distinct') {
        const { from, to } = event;
        requireValue(from !== to && people.has(from) && people.has(to), '请选择两个不同的有效学生');
        if (event.type === 'distinct') {
          requireValue(!distinct.has(pairKey(from, to)), '已确认是不同人');
          distinct.set(pairKey(from, to), { ids: [from, to], reason: event.reason, event_id: event.id });
          continue;
        }
        requireValue(!distinct.has(pairKey(from, to)), '这两人已确认不同，需先撤销该判断才能合并');
        const source = people.get(from), target = people.get(to);
        target.member_ids.push(...source.member_ids);
        // Keep all school history; the target's chosen display fields take precedence.
        for (const field of schoolFields) if (!target[field]) target[field] = source[field] || '';
        for (const row of records.values()) if (row.student_id === from) row.student_id = to;
        for (const [key, decision] of [...distinct]) {
          if (!decision.ids.includes(from)) continue;
          distinct.delete(key);
          const ids = decision.ids.map(id => id === from ? to : id);
          distinct.set(pairKey(...ids), { ...decision, ids });
        }
        aliases.set(from, to);
        people.delete(from);
      } else if (event.type === 'move') {
        requireValue(people.has(event.from), '原学生不存在');
        requireValue(Array.isArray(event.record_ids) && event.record_ids.length > 0 && new Set(event.record_ids).size === event.record_ids.length, '请选择不重复的成绩');
        if (event.new_student) {
          const person = event.new_student;
          requireValue(typeof person.id === 'string' && /^s-[a-zA-Z0-9-]+$/.test(person.id) && !people.has(person.id) && !aliases.has(person.id), '新学生 ID 无效或已存在');
          requireValue(typeof person.name === 'string' && person.name.trim(), '新学生姓名不能为空');
          requireValue(event.to === person.id, '新学生 ID 与目标不一致');
          people.set(person.id, { id: person.id, name: person.name.trim(), primary_school: '', middle_school: '', high_school: '', member_ids: [person.id] });
        }
        requireValue(event.from !== event.to && people.has(event.to), '目标学生无效');
        for (const id of event.record_ids) {
          requireValue(records.has(id) && records.get(id).student_id === event.from, '成绩不属于原学生：' + id);
          records.get(id).student_id = event.to;
        }
      }
    }
    const baseById = new Map(students.map(person => [person.id, person]));
    const schoolsById = new Map();
    for (const row of records.values()) {
      if (!schoolsById.has(row.student_id)) schoolsById.set(row.student_id, []);
      if (row.school) schoolsById.get(row.student_id).push(row.school);
    }
    const list = [...people.values()];
    for (const person of list) {
      const history = [];
      for (const id of person.member_ids) {
        const base = baseById.get(id);
        if (!base) continue;
        for (const field of schoolFields) if (base[field]) history.push(base[field]);
      }
      history.push(...(schoolsById.get(person.id) || []));
      person.school_history = [...new Set(history)];
      if (!person.primary_school && !person.middle_school && !person.high_school) person.display_school = person.school_history[0] || '';
    }
    const rows = [...records.values()];
    for (const row of rows) { row.original_name = row.name; row.name = people.get(row.student_id).name; }
    return { students: list, rows, byId: Object.fromEntries(people), aliases: Object.fromEntries([...aliases].map(([id]) => [id, resolve(id)])), distinct: [...distinct.values()], active };
  }

  // Metadata has stable student IDs. Preserve multiple accounts after a merge.
  function metadata(view, profiles, achievements) {
    requireValue(Array.isArray(profiles) && achievements && typeof achievements === 'object' && !Array.isArray(achievements), '账号或成就数据格式无效');
    const valid = id => typeof id === 'string' && Object.prototype.hasOwnProperty.call(view.byId, view.aliases[id] || id);
    for (const profile of profiles) requireValue(valid(profile.id), '账号引用无效学生：' + profile.id);
    for (const [id, values] of Object.entries(achievements)) {
      requireValue(valid(id), '成就引用无效学生：' + id);
      requireValue(Array.isArray(values) && values.every(value => typeof value === 'string'), '成就必须为字符串数组：' + id);
    }
    const mappedProfiles = profiles.map(profile => ({ ...profile, id: view.aliases[profile.id] || profile.id }));
    const mappedAchievements = Object.create(null);
    for (const [id, values] of Object.entries(achievements)) {
      const target = view.aliases[id] || id;
      mappedAchievements[target] = [...new Set([...(mappedAchievements[target] || []), ...values])];
    }
    return { profiles: mappedProfiles, achievements: mappedAchievements };
  }

  function candidates(view) {
    const groups = new Map(), excluded = new Set(view.distinct.map(d => pairKey(...d.ids)));
    for (const person of view.students) {
      const key = person.name.trim();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(person);
    }
    const pairs = [];
    for (const group of groups.values()) for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      if (!excluded.has(pairKey(group[i].id, group[j].id))) pairs.push({ name: group[i].name, from: group[i].id, to: group[j].id });
    }
    return pairs;
  }
  return { project, metadata, candidates, activeEvents };
});
