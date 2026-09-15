'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const identity = require('../js/identity.js');
const people = [{ id:'s1',name:'张三',primary_school:'甲小学' },{ id:'s2',name:'张三',middle_school:'乙中学' },{ id:'s3',name:'张三',middle_school:'丙中学' }];
const rows = [{ id:'r1',student_id:'s1',name:'张三',school:'甲小学',year:2020,contest:'市赛小学组',award:'一等奖' },{ id:'r2',student_id:'s1',name:'张三',school:'乙中学',year:2022,contest:'CSP-J',award:'二等奖' },{ id:'r3',student_id:'s2',name:'张三',school:'乙中学',year:2023,contest:'NOIP',award:'一等奖' }];
const event = (id,type,props) => ({ id,type,reason:'已核对公示',...props });
const ledger = events => ({ version:1,events });
const project = events => identity.project(people,rows,ledger(events));
test('同名不自动合并；原数据不被修改', () => {
  const before = JSON.stringify({people,rows});
  const view = project([]);
  assert.equal(view.students.length,3); assert.equal(identity.candidates(view).length,3);
  project([event('1','merge',{from:'s1',to:'s2'})]);
  assert.equal(JSON.stringify({people,rows}),before);
});
test('合并、连续合并和旧链接解析；原始参赛学校不变', () => {
  const view = project([event('1','merge',{from:'s1',to:'s2'}),event('2','merge',{from:'s2',to:'s3'})]);
  assert.equal(view.students.length,1); assert.equal(view.aliases.s1,'s3'); assert.equal(view.aliases.s2,'s3');
  assert.ok(view.rows.every(r=>r.student_id==='s3')); assert.equal(view.rows[0].school,'甲小学'); assert.equal(view.rows[0].original_student_id,'s1');
});
test('明确不同人阻止合并，约束随身份合并传递', () => {
  const events = [event('1','distinct',{from:'s1',to:'s3'}),event('2','merge',{from:'s1',to:'s2'})];
  assert.equal(identity.candidates(project(events)).length,0);
  assert.throws(()=>project([...events,event('3','merge',{from:'s2',to:'s3'})]),/确认不同/);
});
test('选中部分成绩拆分，新身份不继承账号与成就', () => {
  const view = project([event('1','move',{from:'s1',to:'s-new',record_ids:['r2'],new_student:{id:'s-new',name:'张三'}})]);
  assert.equal(view.rows[0].student_id,'s1'); assert.equal(view.rows[1].student_id,'s-new'); assert.equal(view.byId['s-new'].display_school,'乙中学');
  const meta=identity.metadata(view,[{id:'s1',luogu:'123'}],{s1:['成就']});
  assert.equal(meta.profiles[0].id,'s1'); assert.equal(meta.achievements['s-new'],undefined);
});
test('成绩转移校验归属、重复选择和新 ID 冲突', () => {
  for(const record_ids of [['r3'],['r1','r1'],[],['missing']]) assert.throws(()=>project([event('1','move',{from:'s1',to:'s2',record_ids})]));
  assert.throws(()=>project([event('1','move',{from:'s1',to:'s2',record_ids:['r1'],new_student:{id:'s2',name:'张三'}})]));
});
test('撤销按逆序恢复，保留历史；不能撤销中间操作', () => {
  const merge=event('1','merge',{from:'s1',to:'s2'}), move=event('2','move',{from:'s2',to:'s3',record_ids:['r1']});
  assert.throws(()=>project([merge,move,event('3','undo',{target:'1'})]),/最近/);
  const view=project([merge,move,event('3','undo',{target:'2'}),event('4','undo',{target:'1'})]);
  assert.equal(view.students.length,3); assert.deepEqual(view.rows.map(r=>r.student_id),rows.map(r=>r.student_id));
});
test('合并后同名成就只按 ID 汇总，撤销后恢复', () => {
  const profiles=[{id:'s1',luogu:'1'},{id:'s2',luogu:'2'}],achievements={s1:['甲'],s2:['乙'],s3:['丙']};
  const merge=event('1','merge',{from:'s1',to:'s2'});
  const meta=identity.metadata(project([merge]),profiles,achievements);
  assert.deepEqual(meta.achievements.s2,['甲','乙']); assert.deepEqual(meta.achievements.s3,['丙']); assert.deepEqual(meta.profiles.map(p=>p.id),['s2','s2']);
  assert.deepEqual({ ...identity.metadata(project([merge,event('2','undo',{target:'1'})]),profiles,achievements).achievements },achievements);
});
test('错误基础引用、重复 ID、缺失依据使校验失败', () => {
  assert.throws(()=>identity.project(people,[...rows,rows[0]],ledger([])),/重复/);
  assert.throws(()=>identity.project(people,[{id:'r',student_id:'missing'}],ledger([])),/不存在/);
  assert.throws(()=>project([event('1','merge',{from:'s1',to:'s2',reason:''})]),/依据/);
});
test('姓名键资料被拒绝，撤销拆分不能遗留悬空资料', () => {
  assert.throws(()=>identity.metadata(project([]),[],{'张三':['成就']}),/无效学生/);
  const split=event('1','move',{from:'s1',to:'s-new',record_ids:['r2'],new_student:{id:'s-new',name:'张三'}});
  assert.throws(()=>identity.metadata(project([split,event('2','undo',{target:'1'})]),[{id:'s-new'}],{}),/无效学生/);
});
test('真实数据接入身份层后评级、评分和奖项统计保持不变', () => {
  const vm=require('node:vm');
  const root=path.resolve(__dirname,'..');
  const source=fs.readFileSync(path.join(root,'site.js'),'utf8');
  const context={}; vm.runInNewContext(source.slice(0,source.indexOf('\ninit();')),context);
  const students=JSON.parse(fs.readFileSync(path.join(root,'data/students.json'))), records=JSON.parse(fs.readFileSync(path.join(root,'data/results.json')));
  const before=context.buildPlayerStats(records,Object.fromEntries(students.map(p=>[p.id,p])));
  const view=identity.project(students,records,ledger([]));
  const after=context.buildPlayerStats(view.rows,view.byId);
  assert.equal(JSON.stringify(after),JSON.stringify(before));
  const merged=identity.project(students,records,ledger([event('merge','merge',{from:'s2763',to:'s2764'})]));
  const stats=context.buildPlayerStats(merged.rows,merged.byId).find(p=>p.sid==='s2764');
  const originals=before.filter(p=>['s2763','s2764'].includes(p.sid));
  assert.equal(stats.rating,Math.max(...originals.map(p=>p.rating)));
  assert.equal(stats.score,originals.reduce((sum,p)=>sum+p.score,0));
  assert.equal(merged.rows.length,records.length);
});
test('本机服务持久化、并发冲突、撤销、跨站防护及只读预览', async t => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hfoi-identity-')); fs.mkdirSync(path.join(temp,'data'));
  for (const [name,value] of Object.entries({'students.json':people,'results.json':rows,'identity_events.json':ledger([]),'player_profiles.json':[],'player_achievements.json':{}})) fs.writeFileSync(path.join(temp,'data',name),JSON.stringify(value));
  const {createServer}=require('../tools/identity-server.cjs');const server=createServer({dataRoot:temp});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+server.address().port;
  const get=async()=> (await fetch(base+'/api/state')).json();
  const initial=await get();
  const localBase='http://localhost:'+server.address().port;
  assert.equal((await fetch(localBase+'/api/state')).status,200);
  const localPost=await fetch(localBase+'/api/action',{method:'POST',headers:{Origin:localBase,'Content-Type':'application/json','X-Identity-Token':initial.token},body:JSON.stringify({revision:'stale',action:{type:'distinct',from:'s1',to:'s2',reason:'测试'}})});
  assert.equal(localPost.status,409); // localhost passes origin validation, then reaches revision checking.
  const post=(state,action,origin=base)=>fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-Identity-Token':state.token,Origin:origin},body:JSON.stringify({revision:state.revision,action})});
  assert.equal((await post(initial,{type:'merge',from:'s1',to:'s2',reason:'核实'},'https://example.com')).status,403);
  assert.equal((await post(initial,{type:'merge',from:'s1',to:'s2',reason:'核实'})).status,200);
  assert.equal((await post(initial,{type:'merge',from:'s1',to:'s2',reason:'核实'})).status,409);
  const merged=await get(); assert.equal(merged.view.students.length,2);
  assert.equal((await post(merged,{type:'undo',target:merged.view.active[0].id,reason:'撤销核对'})).status,200);
  assert.equal((await get()).view.students.length,3);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(temp,'data/results.json'))),rows);
  assert.equal((await fetch(base+'/.git/config')).status,404);
  assert.equal((await fetch(base+'/hfoi-player-detail?sid=s1')).status,200);
});
