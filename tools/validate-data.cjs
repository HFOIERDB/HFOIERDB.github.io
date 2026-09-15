'use strict';
const fs = require('node:fs');
const path = require('node:path');
const identity = require('../js/identity.js');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, 'data', file), 'utf8'));
const students = read('students.json'), rows = read('results.json'), ledger = read('identity_events.json');
const view = identity.project(students, rows, ledger);
identity.metadata(view, read('player_profiles.json'), read('player_achievements.json'));
const validIds = new Set([...students.map(p => p.id), ...view.students.map(p => p.id), ...Object.keys(view.aliases)]);
for (const profile of read('player_profiles.json')) {
  if (!validIds.has(profile.id)) throw new Error('账号资料引用无效学生 ID：' + profile.id);
  for (const key of ['luogu', 'codeforces', 'atcoder']) if (profile[key] != null && typeof profile[key] !== 'string') throw new Error('账号字段必须是字符串：' + profile.id);
}
for (const [id, values] of Object.entries(read('player_achievements.json'))) {
  if (!validIds.has(id)) throw new Error('成就引用无效学生 ID：' + id);
  if (!Array.isArray(values) || values.some(v => typeof v !== 'string')) throw new Error('成就必须是字符串数组：' + id);
}
console.log('数据校验通过：' + rows.length + ' 条成绩，' + view.students.length + ' 个有效身份，' + identity.candidates(view).length + ' 对同名待核对。');
