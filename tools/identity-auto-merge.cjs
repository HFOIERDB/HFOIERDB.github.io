'use strict';
const fs = require('node:fs');
const path = require('node:path');
const identity = require('../js/identity.js');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, 'data', file), 'utf8'));
const normalize = value => String(value || '').trim().replace(/\s+/g, '').toLowerCase();
const students = read('students.json');
const results = read('results.json');
const ledger = read('identity_events.json');
const aliases = read('school_aliases.json');
const rules = read('player_merges.json');
const canonical = value => aliases[normalize(value)] || aliases[value] || value;
const schoolKey = value => normalize(canonical(value));

function ruleSchools(rule) {
  return new Set([...Object.values(rule.schools || {}), ...(rule.merged_schools || [])].map(schoolKey));
}
function lastYear(records, id) {
  return records.filter(row => row.student_id === id).reduce((max, row) => Math.max(max, Number(row.year) || 0), 0);
}
function numericId(id) {
  const match = String(id).match(/(\d+)$/);
  return match ? Number(match[1]) : -1;
}
function plan() {
  const view = identity.project(students, results, ledger);
  const peopleByName = new Map();
  for (const person of view.students) {
    if (!peopleByName.has(person.name)) peopleByName.set(person.name, []);
    peopleByName.get(person.name).push(person);
  }
  const byNameRules = new Map();
  for (const rule of rules) {
    if (!byNameRules.has(rule.name)) byNameRules.set(rule.name, []);
    byNameRules.get(rule.name).push({ rule, schools: ruleSchools(rule) });
  }
  const merges = [], ambiguous = [], reviewed = new Set();
  for (const [name, people] of peopleByName) {
    if (people.length < 2) continue;
    const candidates = [];
    for (const candidate of byNameRules.get(name) || []) {
      const matched = people.filter(person => person.school_history.length && person.school_history.every(school => candidate.schools.has(schoolKey(school))));
      if (matched.length > 1) candidates.push({ ...candidate, people: matched });
    }
    const covered = new Map();
    for (const candidate of candidates) for (const person of candidate.people) {
      if (!covered.has(person.id)) covered.set(person.id, []);
      covered.get(person.id).push(candidate);
    }
    for (const candidate of candidates) {
      const unique = candidate.people.every(person => (covered.get(person.id) || []).length === 1);
      if (!unique) {
        ambiguous.push({ name, ids: candidate.people.map(person => person.id), reason: '同名人员同时符合多条历史就学路径规则' });
        continue;
      }
      const sorted = [...candidate.people].sort((a, b) => lastYear(view.rows, b.id) - lastYear(view.rows, a.id) || view.rows.filter(r => r.student_id === b.id).length - view.rows.filter(r => r.student_id === a.id).length || numericId(b.id) - numericId(a.id));
      const target = sorted[0];
      for (const source of sorted.slice(1)) {
        const key = [source.id, target.id].sort().join('|');
        if (reviewed.has(key)) continue;
        reviewed.add(key);
        merges.push({
          from: source.id,
          to: target.id,
          name,
          reason: `历史人工合并规则记录该选手就读于：${[...candidate.schools].join('、')}。两个身份的学校记录均完全落入该路径；保留有最新比赛记录的 ${target.id}。`,
          evidence: { sourceSchools: source.school_history, targetSchools: target.school_history }
        });
      }
    }
  }
  const unresolved = [...peopleByName].filter(([, people]) => people.length > 1).map(([name, people]) => ({
    name,
    identities: people.map(person => ({ id: person.id, schools: person.school_history, records: view.rows.filter(row => row.student_id === person.id).map(row => ({ year: row.year, contest: row.contest, school: row.school, rank: row.rank, award: row.award })) }))
  }));
  const mergedIds = new Set(merges.flatMap(item => [item.from, item.to]));
  return { generatedAt: new Date().toISOString(), automaticMerges: merges, ambiguousRules: ambiguous, unresolved: unresolved.filter(group => group.identities.some(person => !mergedIds.has(person.id)) || group.identities.filter(person => mergedIds.has(person.id)).length !== group.identities.length) };
}
const report = plan();
if (process.argv.includes('--apply')) {
  const events = report.automaticMerges.map((merge, index) => ({
    id: `auto-merge-20260912-${String(index + 1).padStart(3, '0')}`,
    type: 'merge', from: merge.from, to: merge.to,
    reason: merge.reason,
    at: '2026-09-12T00:00:00.000Z'
  }));
  const next = { version: 1, events: [...ledger.events, ...events] };
  identity.project(students, results, next);
  fs.writeFileSync(path.join(root, 'data', 'identity_events.json'), JSON.stringify(next, null, 2) + '\n', 'utf8');
}
const output = path.join(root, 'docs', 'identity-merge-review.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ automaticMerges: report.automaticMerges.length, ambiguousRules: report.ambiguousRules.length, unresolvedGroups: report.unresolved.length, report: output }, null, 2));
