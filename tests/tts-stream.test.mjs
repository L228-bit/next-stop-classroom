import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const load=async name=>import('data:text/javascript;base64,'+Buffer.from(ts.transpile(fs.readFileSync(`lib/${name}.ts`,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));
const {audioEvents}=await load('tts-stream');
const {StreamPlayback}=await load('stream-playback');
test('SSE emits first audio before completion and handles fragmented packets',async()=>{
 const wire=new TextEncoder().encode('data: '+JSON.stringify({output:{audio:{data:btoa('1234')}}})+'\n\ndata: '+JSON.stringify({output:{audio:{data:btoa('5678')}}})+'\n\n');
 const output=[];for await(const bytes of audioEvents(new ReadableStream({start(c){for(let i=0;i<wire.length;i+=3)c.enqueue(wire.slice(i,i+3));c.close();}})))output.push(new TextDecoder().decode(bytes));
 assert.deepEqual(output,['1234','5678']);
});
test('stream player schedules audio before HTTP ends; leaving cancels queued audio',async()=>{
 let transport,started=0,stopped=0,cancelled=false;
 const oldFetch=globalThis.fetch,oldContext=globalThis.AudioContext;
 globalThis.AudioContext=class{state='running';currentTime=0;destination={};resume(){return Promise.resolve();}close(){return Promise.resolve();}createGain(){return {gain:{value:1},connect(){}};}createBuffer(c,n,r){return {duration:n/r,getChannelData:()=>new Float32Array(n)};}createBufferSource(){return {playbackRate:{value:1},connect(){},disconnect(){},start(){started++;},stop(){stopped++;}};}};
 globalThis.fetch=async()=>new Response(new ReadableStream({start(c){transport=c;},cancel(){cancelled=true;}}));
 const states=[],player=new StreamPlayback(s=>states.push(s));
 try{
  const promise=player.play({text:'测试',speaker:'旁白'});await new Promise(r=>setTimeout(r,0));
  const wav=new Uint8Array(48),v=new DataView(wav.buffer);wav.set(new TextEncoder().encode('RIFF'),0);wav.set(new TextEncoder().encode('WAVEfmt '),8);v.setUint32(16,16,true);wav.set(new TextEncoder().encode('data'),36);v.setUint32(40,4,true);transport.enqueue(wav);
  await new Promise(r=>setTimeout(r,0));assert.equal(started,1);assert.ok(states.includes('playing'));
  player.stop();transport.enqueue(new Uint8Array(4));await promise;assert.equal(started,1);assert.equal(stopped,1);assert.equal(cancelled,true);
 }finally{player.clear();globalThis.fetch=oldFetch;globalThis.AudioContext=oldContext;}
});
