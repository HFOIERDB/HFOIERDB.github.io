#!/usr/bin/env node
'use strict';

// A narrowly scoped cleanup for duplicate placeholder identities. A merge is
// proposed only when one SID has no result at all and both same-name SIDs carry
// the exact same school in their recorded school history.
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
for (const person of view.students) {
  if (!groups.has(person.name)) groups.set(person.name, []);
  groups.get(person.name).push(person);
}
const rowsFor = id => view.rows.filter(row => row.student_id === id);
const candidates = [];
for (const [name, people] of groups) for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
  const [a, b] = [people[i], people[j]];
  const [ar, br] = [rowsFor(a.id), rowsFor(b.id)];
  if ((ar.length === 0) === (br.length === 0)) continue;
  const empty = ar.length === 0 ? a : b;
  const populated = ar.length === 0 ? b : a;
  const sharedSchools = empty.school_history.filter(school => populated.school_history.includes(school));
  if (sharedSchools.length) candidates.push({ name, from: empty.id, to: populated.id, sharedSchools });
}
fs.writeFileSync(path.join(root, 'docs', 'identity-empty-merge-review.json'), JSON.stringify({ generatedAt: new Date().toISOString(), automaticMerges: candidates }, null, 2) + '\n');
if (process.argv.includes('--apply')) {
  let number = ledger.events.filter(event => event.id.startsWith('auto-empty-merge-20260912-')).length;
  for (const item of candidates) {
    number += 1;
    ledger.events.push({ id: `auto-empty-merge-20260912-${String(number).padStart(3, '0')}`, type: 'merge', from: item.from, to: item.to, reason: `同名身份 ${item.from} 没有任何成绩，且与 ${item.to} 的学校记录完全重合：${item.sharedSchools.join('、')}。保留有成绩的 ${item.to} 作为主 SID。`, at: '2026-09-12T00:00:00.000Z' });
  }
  fs.writeFileSync(path.join(root, 'data', 'identity_events.json'), JSON.stringify(ledger, null, 2) + '\n');
}
console.log(JSON.stringify({ candidates: candidates.length, applied: process.argv.includes('--apply') ? candidates.length : 0 }, null, 2));
