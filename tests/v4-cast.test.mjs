import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v4-cast-'));
fs.writeFileSync(path.join(dir,'cast.mjs'),ts.transpile(fs.readFileSync('lib/v4-cast.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}));
const {cast,characterFor,mirrorFor}=await import(path.join(dir,'cast.mjs'));
test('every scripted speaker has a character and an existing image',()=>{
 const staging=JSON.parse(fs.readFileSync('lib/story-v4-direction.json','utf8'));
 const speakers=new Set(Object.values(staging).flatMap(ch=>Object.values(ch).flat()).map(cue=>cue.speaker));
 for(const speaker of speakers) {
  assert.ok(cast.some(person=>person.name===speaker),speaker);
  for(let chapter=0;chapter<9;chapter++)assert.ok(fs.existsSync('public'+characterFor(speaker,chapter).image),`${speaker} chapter ${chapter}`);
 }
});
test('students and children keep separate images; protagonist ages with the story',()=>{
 assert.equal(characterFor('学生',2).image,characterFor('同桌',3).image);
 assert.notEqual(characterFor('学生',2).image,characterFor('笑笑',3).image);
 assert.notEqual(characterFor('孩子',7).image,characterFor('学生',7).image);
 assert.match(characterFor('你',0).image,/player-v2/);
 assert.match(characterFor('你',7).image,/player-43/);
 assert.match(characterFor('你',8).image,/player-60/);
});
test('gaze points inward on both sides without random flips',()=>{
 for(const person of cast)for(const side of ['left','right']){
  const flip=mirrorFor(person,side);
  const gaze=flip?(person.facing==='left'?'right':'left'):person.facing;
  assert.equal(gaze,side==='left'?'right':'left');
  assert.equal(mirrorFor(person,side),flip);
 }
});
