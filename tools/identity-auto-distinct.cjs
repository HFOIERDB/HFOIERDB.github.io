#!/usr/bin/env node
'use strict';

// Marks same-name identities as different only when the source contains an
// impossible overlap: the same contest in the same year at different schools.
// It never merges, changes a SID, or moves a result.
const fs = require('fs');
const path = require('path');
const Identity = require('../js/identity.js');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const students = read('students.json');
const results = read('results.json');
const ledger = read('identity_events.json');
const view = Identity.project(students, results, ledger);
const groups = new Map();
for (const person of view.students) (groups.get(person.name) || groups.set(person.name, []).get(person.name)).push(person);
const existing = new Set(view.distinct.map(d => JSON.stringify([...d.ids].sort())));
const candidates = [];
for (const [name, people] of groups) for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
  const [a, b] = [people[i], people[j]];
  if (existing.has(JSON.stringify([a.id, b.id].sort()))) continue;
  const ar = view.rows.filter(row => row.student_id === a.id);
  const br = view.rows.filter(row => row.student_id === b.id);
  const conflicts = [];
  for (const left of ar) for (const right of br) {
    if (left.year === right.year && left.contest === right.contest && left.school && right.school && left.school !== right.school) {
      conflicts.push({ year: left.year, contest: left.contest, schools: [left.school, right.school] });
    }
  }
  if (conflicts.length) candidates.push({ name, from: a.id, to: b.id, conflicts });
}
const report = { generatedAt: new Date().toISOString(), automaticDistinct: candidates };
fs.writeFileSync(path.join(root, 'docs', 'identity-distinct-review.json'), JSON.stringify(report, null, 2) + '\n');
if (process.argv.includes('--apply')) {
  let number = ledger.events.filter(event => event.id.startsWith('auto-distinct-20260912-')).length;
  for (const item of candidates) {
    number += 1;
    const proof = item.conflicts.map(c => `${c.year} ${c.contest}：${c.schools[0]} / ${c.schools[1]}`).join('；');
    ledger.events.push({ id: `auto-distinct-20260912-${String(number).padStart(3, '0')}`, type: 'distinct', from: item.from, to: item.to, reason: `同名但在同一年同一赛事以不同学校参赛，无法为同一人：${proof}。`, at: '2026-09-12T00:00:00.000Z' });
  }
  fs.writeFileSync(path.join(root, 'data', 'identity_events.json'), JSON.stringify(ledger, null, 2) + '\n');
}
console.log(JSON.stringify({ candidates: candidates.length, applied: process.argv.includes('--apply') ? candidates.length : 0 }, null, 2));
