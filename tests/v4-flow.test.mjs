import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v4-flow-'));
const story=JSON.parse(fs.readFileSync('lib/story-v4.json','utf8'));
for(const name of ['v4-flow','v4-memory','v4-state','v4-ending','reading','ai','tts','speech-playback','local-api']) {
 const source=fs.readFileSync(`lib/${name}.ts`,'utf8').replace(/import (story|chapters) from '.\/story-v4.json';/,(_,binding)=>`const ${binding} = ${JSON.stringify(story)};`).replace("import direction from './story-v4-direction.json';",`const direction=${fs.readFileSync('lib/story-v4-direction.json','utf8')};`).replace(/from '(\.\/[a-z0-9-]+)'/g,"from '$1.mjs'");
 fs.writeFileSync(path.join(dir,name+'.mjs'),ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}));
}
const {initial,advance,back,pick,valid,confirmInterlude,revealEnding,restoreProgress,jumpToChapter,jumpToEnding}=await import(path.join(dir,'v4-flow.mjs'));
const {memoriesFor,selectedMemories,memoryPassage}=await import(path.join(dir,'v4-memory.mjs'));
const {createReader,readingDelay}=await import(path.join(dir,'reading.mjs'));
const {validateAIInput,parseAIResult,buildMessages}=await import(path.join(dir,'ai.mjs'));
test('all chapter gates stop progression; ending needs explicit reveal',()=>{
 let g=confirmInterlude(confirmInterlude(initial));
 for(let chapter=0;chapter<story.length;chapter++) {
  assert.equal(g.chapter,chapter);assert.equal(g.phase,'chapter');assert.deepEqual(advance(g),g);
  g={...g,phase:'intro'};
  for(let n=0;g.phase==='intro'&&n<100;n++)g=advance(g);
  assert.equal(g.phase,'choice');g=pick(g,chapter%3);
  for(let n=0;['branch','common'].includes(g.phase)&&n<100;n++)g=advance(g);
  assert.ok(valid(g));
 }
 assert.equal(g.phase,'epilogue');assert.deepEqual(advance(g),g);
 assert.equal(valid({...g,phase:'end'}),false);assert.equal(back(g).phase,'branch');
 g=confirmInterlude(g);assert.equal(g.phase,'recollection');
 for(let i=0;i<3;i++){assert.equal(revealEnding(g).phase,'recollection');g=advance(g);assert.ok(valid(g));}
 assert.equal(advance(g).phase,'recollection');g=revealEnding(g);assert.equal(g.phase,'end');assert.ok(valid(g));
});
const complete=()=>({...initial,chapter:story.length-1,phase:'epilogue',picks:Object.fromEntries(story.map(c=>[c.id,0]))});
test('memory selection prioritizes exact player words and covers the full timeline',()=>{
 let g=complete();assert.deepEqual(selectedMemories(g).map(m=>m.id),['01','03','06','09']);
 g.answers={'03':{text:'这句话必须原样保存。',reply:'当时的一句回应。',speaker:'旁白',choice:0}};
 const before=JSON.stringify(g);
 const memories=memoriesFor(g);assert.equal(memories.length,story.length);assert.equal(memories[2].text,g.answers['03'].text);assert.equal(memories[2].reply,g.answers['03'].reply);
 assert.equal(selectedMemories(g).length,4);assert.ok(selectedMemories(g).some(m=>m.id==='03'));
 assert.equal(memories[0].text,story[0].choices[0].label);assert.equal(memories[0].reply,story[0].choices[0].lines[0]);
 assert.ok(memoryPassage(memories[2]).includes(g.answers['03'].text));assert.equal(JSON.stringify(g),before);
 g.answers=Object.fromEntries(story.map(c=>[c.id,{text:'我自己的原话'+c.id,reply:'回答。',speaker:'旁白',choice:0}]));
 assert.deepEqual(selectedMemories(g).map(m=>m.id),['01','03','06','09']);assert.ok(selectedMemories(g).every(m=>m.source==='custom'));
 assert.equal(memoriesFor({...initial}).length,0);
});
test('resume, migration and rechoosing cannot bypass recollection',()=>{
 const old={...complete(),phase:'end'};const migrated=restoreProgress(old);assert.equal(migrated.phase,'epilogue');assert.deepEqual(migrated.picks,old.picks);
 const inProgress={...initial,phase:'intro',line:2};assert.deepEqual(restoreProgress(inProgress),inProgress);
 const during={...complete(),phase:'recollection',line:2};assert.deepEqual(restoreProgress(JSON.parse(JSON.stringify(during))),during);
 assert.equal(valid({...during,line:4}),false);assert.equal(valid({...during,picks:{'09':0}}),false);
 let final={...during,line:3};final=revealEnding(final);assert.equal(restoreProgress(final).phase,'end');
 const replay=pick({...final,chapter:2,phase:'choice'},1);assert.equal(replay.recollectionDone,false);assert.deepEqual(memoriesFor(replay).map(m=>m.id),['01','02','03']);
 assert.equal(revealEnding({...complete(),phase:'intro'}).phase,'intro');
});
function fakeClock(){
 let now=0,serial=0;const tasks=new Map();
 return {set(fn,ms){const id=++serial;tasks.set(id,{fn,at:now+ms});return id;},clear(id){tasks.delete(id);},now:()=>now,tick(ms){const until=now+ms;for(;;){const next=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>until)break;tasks.delete(next[0]);now=next[1].at;next[1].fn();}now=until;}};
}
test('typewriter punctuation, click completion and double-click guard',()=>{
 const time=fakeClock();let view;const r=createReader('甲，乙。',(count,done)=>{view={count,done};},false,time);
 assert.equal(readingDelay('甲'),35);assert.equal(readingDelay('，'),120);assert.equal(readingDelay('。'),260);
 time.tick(70);assert.equal(view.count,2);time.tick(119);assert.equal(view.count,2);time.tick(1);assert.equal(view.count,3);
 assert.equal(r.advance(),false);assert.deepEqual(view,{count:4,done:true});assert.equal(r.advance(),false);time.tick(180);assert.equal(r.advance(),true);r.cancel();
});
test('pause, cancel, back and reduced motion do not leak old text timers',()=>{
 const time=fakeClock();let view;let updates=0;const r=createReader('你好👋。',(count,done)=>{view={count,done};updates++;},false,time);
 time.tick(35);r.pause(true);time.tick(1000);assert.equal(view.count,1);r.pause(false);time.tick(35);assert.equal(view.count,2);
 r.cancel();const before=updates;time.tick(1000);assert.equal(updates,before);
 const instant=createReader('上一句话。',(count,done)=>{view={count,done};},true,time);assert.deepEqual(view,{count:5,done:true});assert.equal(instant.advance(),true);instant.cancel();
});
test('AI answer saves once and flows into unchanged original branch',()=>{
 const answer={text:'请师傅教教我',reply:'陈应把旁边的椅子拉了过来。',speaker:'旁白',choice:0};
 const g=pick({...initial,phase:'choice'},0,answer);
 assert.equal(g.phase,'ai');assert.ok(valid(g));assert.equal(g.answers['01'].text,answer.text);
 assert.equal(advance(g).phase,'branch');assert.deepEqual(pick(g,1),g);
 const replaced=pick({...g,phase:'choice',picks:{...g.picks,'02':2}},1);
 assert.deepEqual(replaced.picks,{'01':1});assert.deepEqual(replaced.answers,{});
});
test('reject corrupt saves and early ending states',()=>{
 assert.equal(valid({...initial,phase:'end'}),false);
 assert.equal(valid({...initial,chapter:story.length-1,phase:'epilogue',picks:{'09':1}}),false);
 assert.equal(valid({...initial,phase:'ai'}),false);
 assert.equal(valid({...initial,phase:'branch'}),false);
 assert.equal(valid({...initial,answers:{'01':{}}}),false);
});
test('server accepts bounded new-script input and rejects ambiguous results',()=>{
 assert.ok(validateAIInput({chapter:0,text:'我会向陈应请教',history:[]}));
 for(const input of [{chapter:9,text:'x',history:[]},{chapter:0,text:' ',history:[]},{chapter:0,text:'x'.repeat(201),history:[]},{chapter:0,text:'x',history:[{chapter:0,choice:0}]}]) assert.equal(validateAIInput(input),null);
 for(const result of ['null','[]','{}','{"choice":null,"reply":"不清楚","speaker":"旁白"}','{"choice":3,"reply":"x","speaker":"旁白"}','{"choice":0,"reply":"x","speaker":"不存在的人"}']) assert.equal(parseAIResult(result),null);
 assert.equal(parseAIResult('{"choice":0,"reply":"坐下来，我们一起看看。","speaker":"陈应"}').speaker,'陈应');
 const messages=buildMessages({chapter:0,text:'我想直接请教师傅',history:[]});
 const context=JSON.parse(messages[1].content);assert.equal(context.scene,story[0].title);assert.equal(context.allowed.length,3);assert.deepEqual(context.context,story[0].intro);
});
test('full player memory reaches matching and replies are at most one sentence', async()=>{
 const {resolveAIResult,oneSentence}=await import(path.join(dir,'ai.mjs'));
 const input=validateAIInput({chapter:2,text:'先缓缓',history:[{chapter:0,choice:0,text:'我想自己先试试',reply:'你把书翻回那道题。'},{chapter:1,choice:2,text:'我不想让学生照抄'}]});
 assert.ok(input);
 const payload=JSON.parse(buildMessages(input)[1].content);
 assert.equal(payload.memory[0].player_said,'我想自己先试试');
 assert.equal(payload.memory[1].player_said,'我不想让学生照抄');
 for(const content of ['{"choice":null,"reply":"请更具体一点","speaker":"旁白"}','invalid','{}']) {
  const result=resolveAIResult(content,input);assert.ok([0,1,2].includes(result.choice));assert.ok(!result.reply.includes('具体'));
 }
 assert.equal(oneSentence('你点点头。陈应把书打开。'),'你点点头。');
 assert.equal(oneSentence('“先坐下，慢慢讲。”他拉开椅子。'),'先坐下，慢慢讲。');
 assert.ok(oneSentence('你'.repeat(100)).length<=60);
 assert.equal(parseAIResult('{"choice":1,"reply":"请说得更具体一点。","speaker":"陈应"}').speaker,'旁白');
 const history=Array.from({length:story.length-1},(_,chapter)=>({chapter,choice:0,text:'记住我的原话'}));
 assert.ok(validateAIInput({chapter:story.length-1,text:'按我的想法来',history}));
 assert.equal(validateAIInput({chapter:story.length-1,text:'x',history:[{chapter:0,choice:0,text:'x'.repeat(201)}]}),null);
});

test('two opening screens precede first chapter and resume independently',()=>{
 assert.equal(initial.phase,'opening');assert.ok(valid(initial));assert.deepEqual(advance(initial),initial);
 const master=confirmInterlude(initial);assert.equal(master.phase,'opening');assert.equal(master.line,1);assert.equal(back(master).line,0);
 assert.deepEqual(restoreProgress(JSON.parse(JSON.stringify(master))),master);
 const chapter=confirmInterlude(master);assert.equal(chapter.phase,'chapter');assert.equal(chapter.openingSeen,true);assert.equal(restoreProgress(chapter).phase,'chapter');
 const old={chapter:0,phase:'chapter',line:0,picks:{},answers:{}};assert.equal(restoreProgress(old).phase,'opening');
});
test('chapter navigation preserves records and ending preview only uses actual memories',()=>{
 const g=pick({...initial,phase:'choice'},0,{text:'我先问问师傅',reply:'陈应点了点头。',speaker:'旁白',choice:0});
 for(let i=0;i<story.length;i++){const target=jumpToChapter(g,i);assert.equal(target.chapter,i);assert.equal(target.phase,'chapter');assert.deepEqual(target.picks,g.picks);assert.deepEqual(target.answers,g.answers);assert.ok(valid(target));}
 assert.deepEqual(jumpToChapter(g,story.length),g);
 let preview=jumpToEnding(g);assert.ok(valid(preview));assert.equal(preview.previewEnding,true);assert.equal(selectedMemories(preview).length,1);
 preview=confirmInterlude(preview);assert.equal(preview.phase,'recollection');preview=revealEnding(preview);assert.equal(preview.phase,'end');assert.ok(valid(preview));assert.deepEqual(preview.picks,g.picks);assert.deepEqual(restoreProgress(preview),preview);
 const empty=confirmInterlude(jumpToEnding(initial));assert.equal(empty.phase,'recollection');assert.equal(revealEnding(empty).phase,'end');assert.ok(valid(empty));assert.equal(memoriesFor(empty).length,0);
 const full=jumpToEnding(complete());assert.equal(full.previewEnding,false);assert.equal(confirmInterlude(full).phase,'recollection');
});
test('personal ending gets exact records; cached prose invalidates on rechoice',async()=>{
 const {endingMessages,endingFingerprint,validateEndingInput,parseEnding}=await import(path.join(dir,'v4-ending.mjs'));
 const g=pick({...initial,phase:'choice'},0,{text:'我先喝水，再考虑要不要请教',reply:'你让自己慢慢放松下来。',speaker:'旁白',choice:0});
 const input=validateEndingInput(g);assert.ok(input);
 const data=JSON.parse(endingMessages(input)[1].content);assert.equal(data.records.length,1);assert.equal(data.records[0].player_words,g.answers['01'].text);assert.equal(data.records[0].chosen_option,null);assert.equal(data.completed_choices,1);
 assert.equal(validateEndingInput({picks:{'10':0}}),null);assert.equal(validateEndingInput({picks:{'01':3}}),null);assert.equal(validateEndingInput({picks:{},answers:g.answers}),null);
 const cached={...g,generatedEnding:{fingerprint:endingFingerprint(g),text:'日子慢慢过去。'.repeat(15)}};
 assert.equal(endingFingerprint(jumpToChapter(cached,6)),cached.generatedEnding.fingerprint);
 const changed=pick({...cached,phase:'choice'},1);assert.equal(changed.generatedEnding,undefined);assert.notEqual(endingFingerprint(changed),cached.generatedEnding.fingerprint);
 assert.ok(parseEnding(JSON.stringify({text:'日子慢慢过去。'.repeat(15)})));assert.equal(parseEnding('{"text":"太短"}'),null);assert.equal(parseEnding(JSON.stringify({text:'学生信任'.repeat(30)})),null);
});
test('speech validates speakers, binds existing clones to their model and restricts downloads',async()=>{
 const {validateSpeech,voiceFor,safeAudioURL}=await import(path.join(dir,'tts.mjs'));
 assert.ok(validateSpeech({text:'我们一起看看。',speaker:'陈应'}));assert.equal(validateSpeech({text:' ',speaker:'陈应'}),null);assert.equal(validateSpeech({text:'你好',speaker:'未知人物'}),null);assert.equal(validateSpeech({text:'x'.repeat(401),speaker:'你'}),null);
 assert.equal(voiceFor('陈应',{TTS_VOICE_CHEN:'existing-clone'}).model,'qwen3-tts-vc-2026-01-22');assert.equal(voiceFor('陈应',{TTS_VOICE_CHEN:'existing-clone'}).voice,'existing-clone');assert.equal(voiceFor('旁白',{}).voice,'Cherry');assert.equal(voiceFor('你',{}).voice,'Ethan');
 assert.equal(safeAudioURL('http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/a.wav').protocol,'https:');
 for(const url of ['http://localhost:3000/','https://evil.com/a','https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com.evil.com/a','file:///etc/passwd'])assert.equal(safeAudioURL(url),null);
});
test('leaving a scene aborts speech; late replies cannot play; replay reuses audio',async()=>{
 const {SpeechPlayback}=await import(path.join(dir,'speech-playback.mjs'));
 let finish,signal,fetches=0,plays=0,paused=0,revoked=0;const statuses=[];
 const voice=new SpeechPlayback({update:s=>statuses.push(s),url:()=> 'blob:test',revoke:()=>revoked++,audio:()=>({play:async()=>{plays++;},pause:()=>paused++,currentTime:0,onended:null,onerror:null}),fetchClip:(_,s)=>{signal=s;fetches++;return new Promise(resolve=>{finish=resolve;});}});
 voice.setLine({text:'第一幕。',speaker:'旁白'});assert.equal(fetches,1);voice.setLine();assert.ok(signal.aborted);finish(new Blob(['audio']));await new Promise(resolve=>setImmediate(resolve));assert.equal(plays,0);
 voice.setLine({text:'第二幕。',speaker:'陈应'});finish(new Blob(['audio']));await new Promise(resolve=>setImmediate(resolve));assert.equal(plays,1);await voice.play();assert.equal(plays,2);assert.equal(fetches,2);assert.ok(paused>0);
 voice.clear();assert.equal(revoked,1);assert.equal(statuses.at(-1),'idle');
});
test('four complete routes preserve custom memories and invalidate old ending prose',async()=>{
 const {statsFor,endingFor}=await import(path.join(dir,'v4-state.mjs'));
 const {endingFingerprint,endingMessages}=await import(path.join(dir,'v4-ending.mjs'));
 const fixtures=[
  ['AAAAABB','E1','重新找回自己','这一回，也把时间留给自己。',{craft:85,trust:66,purpose:72,energy:34}],
  ['AAAABAA','E2','桃李来信','有些回答，会在很多年后抵达。',{craft:62,trust:82,purpose:67,energy:59}],
  ['AAAAAAB','E3','薪火相传','下一次铃响，有人接着往下讲。',{craft:85,trust:63,purpose:71,energy:38}],
  ['AAAAAAA','E4','平凡而长久','你曾认真地，站在这里。',{craft:75,trust:73,purpose:68,energy:48}],
 ];
 for(const [route,id,name,subtitle,stats] of fixtures){
  let preset=initial,custom=initial;
  for(let chapter=0;chapter<story.length;chapter++){
   const index='ABC'.indexOf(route[chapter]);
   preset=pick({...preset,chapter,phase:'choice'},index);
   custom=pick({...custom,chapter,phase:'choice'},index,{text:`我在第${chapter+1}章的想法`,reply:'你留下了自己的回答。',speaker:'旁白',choice:index});
  }
  assert.deepEqual(statsFor(preset.picks),stats);assert.deepEqual(statsFor(custom.picks),stats);
  const ending=endingFor(stats);assert.equal(ending.id,id);assert.equal(ending.name,name);assert.equal(ending.subtitle,subtitle);assert.ok(ending.text.length>60);
  const payload=JSON.parse(endingMessages(custom)[1].content);assert.equal(payload.ending_theme,name);assert.equal(payload.ending_scene,ending.text);assert.equal(payload.records.length,7);
  let final=confirmInterlude({...custom,phase:'epilogue',line:0});
  for(let i=0;i<3;i++)final=advance(final);
  final=revealEnding(final);assert.equal(final.phase,'end');
  const fingerprint=endingFingerprint(final);
  const old={...final,generatedEnding:{fingerprint:fingerprint.replace('ending-2-','ending-1-'),text:'旧版结尾'}};
  const restored=restoreProgress(JSON.parse(JSON.stringify(old)));assert.ok(restored);
  assert.deepEqual(restored.picks,custom.picks);assert.deepEqual(restored.answers,custom.answers);
  assert.notEqual(restored.generatedEnding.fingerprint,endingFingerprint(restored));
  assert.deepEqual(memoriesFor(restored),memoriesFor(custom));
 }
});
