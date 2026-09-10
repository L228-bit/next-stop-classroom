import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v4-check-'));
for (const name of ['v4-state']) {
  const code = fs.readFileSync(`lib/${name}.ts`, 'utf8').replace("from './game'", "from './game.mjs'");
  fs.writeFileSync(path.join(dir, `${name}.mjs`), ts.transpile(code, {target: ts.ScriptTarget.ES2022, module:ts.ModuleKind.ES2022}));
}
const {statsFor,endingFor} = await import(path.join(dir, 'v4-state.mjs'));
const story = JSON.parse(fs.readFileSync('lib/story-v4.json'));
const cues = JSON.parse(fs.readFileSync('lib/story-v4-direction.json'));
test('initial state and exact priority boundaries',()=>{
 assert.deepEqual(statsFor({}),{craft:40,trust:40,purpose:45,energy:65});
 for (const [energy,trust,craft,id] of [[34,100,100,'E1'],[35,82,85,'E2'],[35,81,85,'E3'],[35,81,84,'E4']]) {
  for(const purpose of [0,100]) assert.equal(endingFor({energy,trust,craft,purpose}).id,id);
 }
});
test('all current chapter paths stay bounded with source chapter IDs',()=>{
 const endings=new Set();
 for(let n=0;n<3**story.length;n++) {let rest=n;const picks={};for(const chapter of story){picks[chapter.id]=rest%3;rest=Math.floor(rest/3);}const stats=statsFor(picks);assert.ok(Object.values(stats).every(x=>x>=0&&x<=100));endings.add(endingFor(stats).id);}
 assert.deepEqual([...endings].sort(),['E1','E2','E3','E4']);
});
test('every paragraph has current staging and valid scene assets',()=>{
 assert.deepEqual(story.map(ch=>ch.id),['01','02','03','04','06','08','09']);
 for(const ch of story){assert.equal(ch.choices.length,3);for(const [segment,lines] of [['intro',ch.intro],...ch.choices.map(c=>[c.id,c.lines]),['common',ch.common]]) {
  assert.equal(cues[ch.id][segment].length,lines.length);
  lines.forEach((line,i)=>assert.equal(cues[ch.id][segment][i].textStart,line.slice(0,18)));
 }}
 assert.equal(story.at(-1).common.length,0);
});
test('spoken dialogue is attributed rather than defaulting to narrator',()=>{
 for(const ch of story) for(const [segment,lines] of [['intro',ch.intro],...ch.choices.map(c=>[c.id,c.lines]),['common',ch.common]]) {
  lines.forEach((line,i)=>{if(line.startsWith('“')) assert.notEqual(cues[ch.id][segment][i].speaker,'旁白',`${ch.id}/${segment}/${i}`);});
 }
 assert.equal(cues['01'].intro[2].speaker,'陈应');
 assert.equal(cues['01'].C[1].speaker,'吴国平');
 assert.equal(cues['01'].common[1].speaker,'徐进');
 assert.equal(cues['06'].intro[1].speaker,'家长');
 assert.equal(cues['04'].common[3].speaker,'吴国平');
 assert.equal(cues['06'].A[3].speaker,'吴国平');
});
