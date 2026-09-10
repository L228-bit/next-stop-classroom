import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('output/2026-09-10-最新用户稿.md','utf8');
const actual=JSON.parse(fs.readFileSync('lib/story-v4.json','utf8'));
// Independent line scanner: verify every displayed paragraph against the supplied copy.
function sourceChapters(){
 const chapters=[];let ch,section,paragraph=[];
 function flush(){if(paragraph.length&&section)section.push(paragraph.join('\n').replace(/\s*\{#[^}]+\}/g,'').trim());paragraph=[];}
 for(const line of source.split('\n')){
  const heading=line.match(/^# (\d{2})　(.+?)\s*\{#c\d+\}$/);
  if(heading){flush();ch={id:heading[1],title:heading[2],time:'',intro:[],choices:[],common:[]};chapters.push(ch);section=ch.intro;continue;}
  if(!ch)continue;
  if(line.startsWith('## 共同结局')){flush();break;}
  const time=line.match(/^\*\*(.+)\*\*$/);if(time&&!ch.time){ch.time=time[1];continue;}
  if(line.startsWith('### ')){
   flush();const choice=line.match(/^### ([ABC])．(.+?)(?:\s*\{#[^}]+\})?$/);
   if(choice){const c={id:choice[1],label:choice[2].trim(),lines:[]};ch.choices.push(c);section=c.lines;}else {assert.match(line,/共同后续/);section=ch.common;}
   continue;
  }
  if(!line.trim()){flush();continue;}
  paragraph.push(line);
 }
 return chapters;
}
test('all titles, dates, options and paragraphs exactly match the latest source',()=>{
 assert.deepEqual(actual,sourceChapters());
 assert.equal(actual.length,7);assert.equal(actual.flatMap(c=>c.choices).length,21);
 assert.deepEqual(actual.map(c=>c.id),['01','02','03','04','06','08','09']);
});
test('changed dialogue and branches appear, while missing chapters stay omitted',()=>{
 const byId=Object.fromEntries(actual.map(c=>[c.id,c]));
 assert.equal(byId['01'].intro[5],'陈应抬头：“书烫手？”');
 assert.equal(byId['02'].choices[0].label,'学你师傅的，拿出手机打开作业帮，让他自己查');
 assert.equal(byId['03'].choices[1].label,'咳嗽一下缓解尴尬，并指出题目出得不好');
 assert.ok(byId['04'].common.some(line=>line.includes('走廊遇见吴国平')));
 assert.equal(byId['06'].choices[0].label,'叫人把家长打一顿');
 assert.equal(byId['09'].choices[1].label,'和大家留下一张大合照');
 assert.equal(byId['05'],undefined);assert.equal(byId['07'],undefined);
 assert.ok(!JSON.stringify(actual).includes('{#'));
});
