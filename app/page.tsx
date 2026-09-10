'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Maximize2, X, Volume2, VolumeX } from 'lucide-react';
import story from '@/lib/story-v4.json';
import scriptSource from '@/lib/story-source.json';
import direction from '@/lib/story-v4-direction.json';
import './story.css';
import GameViewport from './game-viewport';
import ResetControl from './reset-control';
import CharacterSprite from './character-sprite';
import SceneBackground from './scene-background';
import MemoryBoard from './memory-board';
import { useReading, useReducedMotion } from './use-reading';
import { useSpeech } from './use-speech';
import { useEnding } from './use-ending';
import { endingFingerprint } from '@/lib/v4-ending';
import { memoriesFor, selectedMemories, memoryPassage } from '@/lib/v4-memory';
import { scenes } from '@/lib/v4-scenes';
import { characterFor } from '@/lib/v4-cast';
import { statsFor, endingFor } from '@/lib/v4-state';
import { statLabels, type Stats } from '@/lib/v4-state';

import { initial, linesFor, restoreProgress, confirmInterlude, revealEnding, advance, back, pick, jumpToChapter, jumpToEnding, type Progress, type CustomAnswer } from '@/lib/v4-flow';

const key = `next-stop-classroom-${scriptSource.revision}`;
type Cue = { textStart: string; scene: string; cast: string[]; speaker: string };
const staging = direction as Record<string, Record<string, Cue[]>>;
const readingId=(g:Progress)=>`${g.chapter}-${g.phase}-${g.line}`;
const openingNarration = ['你，22 岁。新手高中物理老师。', '这是你的师傅，陈应。'] as const;
function StoryGame() {
  const [g, setG] = useState<Progress>(initial);
  const [ready, setReady] = useState(false);
  const [startScreen, setStartScreen] = useState(true);
  const [draft, setDraft] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [saved, setSaved] = useState(true);
  const [panel, setPanel] = useState<'chapters' | 'journal' | null>(null);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const showWhole=useRef('');
  const reducedMotion=useReducedMotion();
  const dialog = useRef<HTMLDialogElement>(null);
  const ch = story[g.chapter];
  const lines = linesFor(g);
  const remembering=g.phase==='recollection';
  const memories=memoriesFor(g);
  const highlights=selectedMemories(g);
  const memory=remembering?highlights[g.line]:undefined;
  const displayChapter=memory?story[memory.chapter]:ch;
  const paragraph = memory?memoryPassage(memory):remembering?'你还没有留下选择。先在这里停一会儿，再翻开最后一页。':lines[g.line]??'';
  const stats = statsFor(g.picks);
  const choosing = g.phase === 'choice';
  const finished = g.phase === 'end';
  const generated=useEnding(g,!startScreen&&['epilogue','recollection','end'].includes(g.phase),result=>setG(prev=>endingFingerprint(prev)===result.fingerprint?{...prev,generatedEnding:result}:prev));
  const finalEnding=finished&&(generated.text||generated.fallback)?endingFor(stats):null;
  const introducing=g.phase==='opening';
  const interlude = g.phase === 'chapter' || g.phase === 'epilogue';
  const custom = g.phase === 'ai' ? g.answers?.[ch.id] : undefined;
  const segment = g.phase === 'branch' ? ch.choices[g.picks[ch.id] ?? 0].id : g.phase === 'common' || finished ? 'common' : 'intro';
  const cueIndex = choosing ? ch.intro.length - 1 : finished ? ch.common.length - 1 : g.line;
  const baseCue = staging[ch.id][segment]?.[cueIndex] ?? { scene: 'home', cast: [], speaker: '旁白' };
  const cue = custom ? {...baseCue, speaker: custom.speaker} : baseCue;
  const scene = finished ? scenes.home : scenes[memory?.scene??cue.scene];
  const person = characterFor(finished?'你':cue.speaker, Number(ch.id)-1);
  const speakerAge = cue.speaker==='你' ? (ch.id==='01'?22:ch.id==='02'?22:ch.id==='03'?23:ch.id==='04'?23:ch.id==='06'?28:ch.id==='08'?43:60) : cue.speaker==='笑笑'||cue.speaker==='学生'||cue.speaker==='同桌'?16:cue.speaker==='孩子'?10:cue.speaker==='小孩'?13:cue.speaker==='旁白'?40:undefined;
  const narrationText = introducing ? openingNarration[g.line] : finished ? generated.text??finalEnding?.text??'' : paragraph;
  const narrationSpeaker = introducing||remembering||finished ? '旁白' : custom?.speaker??cue.speaker;
  const speechAsset = introducing
    ? `/audio/opening/${String(g.line).padStart(3,'0')}.wav`
    : !finished && !remembering && g.phase !== 'ai' && staging[ch.id]?.[segment]?.[g.line] ? `/audio/${ch.id}/${segment}/${String(g.line).padStart(3,'0')}.wav` : undefined;
  const side = choosing ? 'right' : person.side;
  const opening = g.chapter === 0 && g.phase === 'intro' && g.line === 0;
  const reading=useReading(paragraph,readingId(g),!startScreen&&!introducing&&!interlude&&!choosing&&!finished,reducedMotion||showWhole.current===readingId(g),!!panel||settingsOpen);
  const speech=useSpeech(narrationText,narrationSpeaker,!startScreen&&!interlude&&!choosing&&(!finished||!!finalEnding)&&!panel&&!settingsOpen,speakerAge,speechAsset,g.phase==='ai'||remembering||finished);
  useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) { const restored=restoreProgress(JSON.parse(raw)); if (restored) setG(restored.phase==='end'?{...restored,phase:'epilogue',line:0,recollectionDone:false}:restored); } } catch { setSaved(false); }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(key, JSON.stringify(g)); setSaved(true); } catch { setSaved(false); } }, [g, ready]);
  useEffect(() => { if (panel) dialog.current?.showModal(); else dialog.current?.close(); }, [panel]);
  useEffect(() => {
    fetch('/api/status').then(r=>r.json()).then(data=>setAiAvailable(!!data && typeof data === 'object' && 'available' in data && data.available === true)).catch(()=>setAiAvailable(false));
    return () => requestRef.current?.abort();
  }, []);
  useEffect(() => { requestRef.current?.abort(); requestRef.current=null; setAiBusy(false); setAiError(''); setDraft(''); }, [g.chapter, g.phase]);
  function next() {
    if(aiBusy||choosing||finished||introducing||interlude||!reading.advance())return;
    setG(prev=>advance(prev));
  }
  function previous() { if (!aiBusy) {const prev=back(g);showWhole.current=readingId(prev);setG(prev);} }
  function choose(index: number) { if (!aiBusy) setG(prev=>pick(prev,index)); }
  function restart() {
    requestRef.current?.abort(); requestRef.current=null;
    setAiBusy(false); setAiError(''); setDraft(''); setPanel(null);setSettingsOpen(false);showWhole.current='';speech.clear();generated.clear();
    try {localStorage.removeItem(key);} catch {setSaved(false);}
    setG({...initial,picks:{},answers:{}}); setStartScreen(true);
  }
  function revisit(chapter:number,phase:'chapter'|'choice') {
    setG({...g,chapter,phase,line:0,recollectionDone:false,generatedEnding:undefined,previewEnding:false,picks:Object.fromEntries(Object.entries(g.picks).filter(([id])=>Number(id)<Number(story[chapter].id))),answers:Object.fromEntries(Object.entries(g.answers??{}).filter(([id])=>Number(id)<Number(story[chapter].id)))});
    setPanel(null);showWhole.current='';
  }
  function navigate(chapter:number|'end') {
    requestRef.current?.abort();setG(prev=>chapter==='end'?jumpToEnding(prev):jumpToChapter(prev,chapter));setStartScreen(false);setPanel(null);showWhole.current='';
  }
  async function submitAnswer() {
    if (!draft.trim() || draft.length > 200 || aiBusy || requestRef.current || !choosing) return;
    const controller = new AbortController(); requestRef.current=controller;
    const chapter = g.chapter;
    setAiBusy(true); setAiError('');
    const timeout = setTimeout(()=>controller.abort(), 20000);
    try {
      const response = await fetch('/api/respond', {method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({chapter,text:draft.trim(),history:Object.entries(g.picks).filter(([id])=>Number(id)<Number(story[chapter].id)).map(([id,choice])=>({chapter:story.findIndex(c=>c.id===id),choice,text:g.answers?.[id]?.text,reply:g.answers?.[id]?.reply}))})});
      const result = await response.json() as {choice:number;reply:string;speaker:string;error?:string};
      if (!response.ok) throw new Error(result.error || '回应暂时没有送达，请重试。');
      if (!Number.isInteger(result.choice) || result.choice<0 || result.choice>2 || typeof result.reply!=='string' || !result.reply.trim() || result.reply.length>400 || typeof result.speaker!=='string' || result.speaker.length>20) throw new Error('回应没有完整送达，请重试。');
      if (controller.signal.aborted || requestRef.current!==controller) return;
      const answer:CustomAnswer={text:draft.trim(),reply:result.reply,speaker:result.speaker,choice:result.choice};
      setG(prev=>prev.chapter===chapter && prev.phase==='choice'?pick(prev,result.choice,answer):prev);
    } catch(error) {
      if(requestRef.current===controller) setAiError(error instanceof Error && error.name!=='AbortError'?error.message:'等待回应超时了，你的输入已保留，可以重试。');
    } finally {
      clearTimeout(timeout);
      if(requestRef.current===controller) {requestRef.current=null;setAiBusy(false);}
    }
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]') || aiBusy || panel || e.repeat || (e.target as HTMLElement).closest('input, select, textarea, [contenteditable=true]')) return;
      if (e.key===' ' && (e.target as HTMLElement).closest('button:not(.vn-next), a')) return;
      if (e.key === ' ' || (e.key === 'Enter' && !(e.target as HTMLElement).closest('button, a'))) {
        if (startScreen) { e.preventDefault(); if (ready) setStartScreen(false); return; }
        if (introducing || interlude) { e.preventDefault(); setG(confirmInterlude); return; }
      }
      if (startScreen || introducing || interlude) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); previous(); }
      if (e.key === ' ' || (e.key === 'Enter' && !(e.target as HTMLElement).closest('button, a')) || e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (g.phase === 'choice' && ['1', '2', '3'].includes(e.key)) choose(Number(e.key) - 1);
    };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  });
  const fullscreen=<button className="vn-fullscreen" aria-label="切换全屏" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>{});}}><Maximize2 size={17}/></button>;
  const endReading=useReading(generated.text??finalEnding?.text??'',`ending-${generated.text??finalEnding?.id??''}`,!!finalEnding,reducedMotion,!!panel||settingsOpen);
  const shortcuts=<button className="vn-shortcuts" disabled={!ready||aiBusy} onClick={()=>setPanel('chapters')}><BookOpen size={17}/>章节与结尾</button>;
  const overlays=<>{fullscreen}<dialog className="vn-modal" ref={dialog} onCancel={() => setPanel(null)} onClick={e => { if (e.target === e.currentTarget) setPanel(null); }}>
      <header><h2>{panel === 'chapters' ? '人生章节' : '人生回忆'}</h2><button aria-label="关闭" onClick={() => setPanel(null)}><X size={22} /></button></header>
      {panel === 'chapters' ? <><p className="vn-navigation-note">前往任意章节，或带着已有的回忆看看结尾。</p><div className="vn-chapter-list">{story.map((c, i) => <button key={c.id} className={i === g.chapter ? 'selected' : ''} onClick={()=>navigate(i)}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{c.title}</strong><small>{c.time}</small></div><ArrowRight size={17} /></button>)}</div><button className="vn-ending-shortcut" onClick={()=>navigate('end')}><span>终章</span><strong>铃声之后</strong><small>{memories.length} / {story.length} 段经历已留下</small><ArrowRight size={18}/></button></> : <MemoryBoard key={panel??'closed'} memories={memories} onRechoose={chapter=>revisit(chapter,'choice')}/>}
    </dialog><ResetControl onReset={restart} onOpenChange={setSettingsOpen}/></>;
  if (startScreen) return <GameViewport><main className="vn vn-start">
    <div className="vn-background" style={{backgroundImage:'url(/art/cover-cast.png)'}} />
    <div className="vn-vignette" />
    <section className="vn-title-screen"><p className="vn-kicker">教师人生模拟器</p><h1>下一站，<br/><span>讲台</span></h1><div className="vn-title-rule"/><p className="vn-start-time">{g.phase==='opening'?'九月，新的故事从这里开始。':'你的故事，仍在继续。'}</p>
      <button className="vn-start-button" disabled={!ready} onClick={()=>setStartScreen(false)}>下一站 <ArrowRight size={24}/></button>
      <p className="vn-resume-note">{ready && g.phase!=='opening' ? '继续上次的故事' : '你的第一节课，就要开始了。'}</p>
    </section><span className="vn-start-caption">九月 · 新学期</span>{shortcuts}{overlays}
  </main></GameViewport>;
  if (introducing) return <GameViewport><main className="vn vn-onboarding">
    <SceneBackground image={g.line===0?'bg12':'bg01'}/><div className="vn-vignette"/>
    <div className="vn-onboarding-person"><CharacterSprite person={characterFor(g.line===0?'你':'陈应',0)} side="right" key={g.line}/></div>
    <section className="vn-onboarding-copy" key={g.line}>
      <p className="vn-kicker">{g.line===0?'九月 · 报到日':'在这里，你会遇见'}</p>
      <h1>{g.line===0?<>你，22 岁。<br/><span>新手高中物理老师</span></>:<>这是你的师傅<br/><span>陈应</span></>}</h1>
      <p>{g.line===0?'今天，是你到学校报到的第一天。':'他会陪你，走过讲台前最初的日子。'}</p>
      <button className="vn-start-button" onClick={()=>setG(confirmInterlude)}>{g.line===0?'认识你的师傅':'开始第一章'}<ArrowRight size={22}/></button>
      {g.line===1&&<button className="vn-text-button vn-opening-back" onClick={()=>setG(back)}>返回介绍</button>}
    </section>{shortcuts}{overlays}
  </main></GameViewport>;
  if (interlude) return <GameViewport><main className={`vn vn-interlude ${g.phase==='epilogue'?'vn-before-ending':''}`}>
    <SceneBackground image={g.phase==='epilogue'?'bg20':scene.image}/><div className="vn-vignette"/>
    <section className="vn-interlude-card" key={`${g.chapter}-${g.phase}`}>
      <p className="vn-kicker">{g.phase==='epilogue'?'最后一页':`第 ${String(g.chapter+1).padStart(2,'0')} 章`}</p>
      <span className="vn-interlude-number" aria-hidden="true">{g.phase==='epilogue'?'…':String(g.chapter+1).padStart(2,'0')}</span>
      <h1>{g.phase==='epilogue'?'铃声之后':ch.title}</h1>
      <p>{g.phase==='epilogue'?'你放下粉笔，轻轻合上教案。':ch.time}</p>
      <button className="vn-start-button" onClick={()=>setG(confirmInterlude)}>{g.phase==='epilogue'?'回望来时的路':'继续'} <ArrowRight size={21}/></button>
    </section>
    {g.phase==='epilogue'&&g.previewEnding&&<p className="vn-preview-note">这一次，先看看已有经历会通向哪里。</p>}{shortcuts}{overlays}
    <button className="vn-interlude-home vn-text-button" onClick={()=>setStartScreen(true)}>返回开始页</button>
  </main></GameViewport>;
  return <GameViewport><main className={`vn vn-focus-${side} ${choosing ? 'vn-choosing' : ''} ${ch.id === '08' ? 'vn-winter' : ''} ${finished ? 'vn-finished' : ''} ${remembering?'vn-recollection':''}`}>
    <SceneBackground image={scene.image} label={`${displayChapter.title}：${scene.label}`}/>
    <div className="vn-vignette" />
    <header className="vn-header">
      <button className="vn-brand" onClick={()=>setStartScreen(true)}>下一站，讲台</button>
      <nav aria-label="游戏菜单">
        
        <button disabled={aiBusy} onClick={() => setPanel('chapters')}><BookOpen size={17} />章节</button>
        <button disabled={aiBusy} onClick={() => setPanel('journal')}>回忆</button>

      </nav>
    </header>
    <section className="vn-chapter" aria-label="当前章节">
      <span className="vn-chapter-number">{finished?'终':String(story.findIndex(c=>c.id===displayChapter.id)+1).padStart(2,'0')}<small title="阅读进度">{story.findIndex(c=>c.id===displayChapter.id)+1} / {story.length}</small></span>
      <div><p>{scene.label} <span>·</span> {remembering?'来时的路':'你的物理教师生涯'}</p><h1>{finished?'铃声之后':displayChapter.title}</h1><p className="vn-time">{displayChapter.time}</p></div>
    </section>
    {finalEnding && <aside className="vn-stats" aria-label="人生状态">{(Object.keys(statLabels) as (keyof Stats)[]).map(name => <div key={name}><span>{statLabels[name]}</span><strong>{stats[name]}</strong><meter min="0" max="100" value={stats[name]} aria-label={statLabels[name]} /></div>)}</aside>}
    {!remembering&&<div className={`vn-stage vn-stage-${side}`} aria-label="当前出场人物">
      <CharacterSprite person={person} side={side} key={person.image}/>
    </div>}
    {choosing && <section className="vn-choices" aria-labelledby="choice-heading">
      <p className="vn-kicker">这一刻，由你决定</p><h2 id="choice-heading">你会怎么做？</h2>
      <p className="vn-prompt">{ch.intro[ch.intro.length - 1]}</p>
      <div className="vn-answer-area">
      <form className="vn-free-answer" onSubmit={e=>{e.preventDefault();void submitAnswer();}}>
        <label htmlFor="player-answer">按自己的想法回答</label>
        <textarea id="player-answer" value={draft} maxLength={200} rows={3} disabled={aiBusy} onChange={e=>setDraft(e.target.value)} placeholder="写下你会说的话，或打算怎么做……"/>
        <div><span>{draft.length} / 200</span><button disabled={aiBusy || !draft.trim()} type="submit">{aiBusy?'正在回应…':'说出我的想法'} <ArrowRight size={17}/></button></div>
        {aiError && <p className="vn-ai-error" role="alert">{aiError}</p>}
        {aiAvailable===false && !aiError && <p className="vn-ai-note">自由回答暂未连接，右侧选项仍可继续故事。</p>}
      </form>
      <div className="vn-preset-answers"><p>或者，选择一种做法</p><div className="vn-choice-list">{ch.choices.map((choice, i) => <button key={choice.id} disabled={aiBusy} onClick={() => choose(i)}><span className="vn-choice-letter">{choice.id}</span><span>{choice.label}</span><ArrowRight size={18} /></button>)}</div></div>
      </div>
      <button disabled={aiBusy} className="vn-text-button" onClick={() => setG({ ...g, phase: 'intro', line: 0 })}><ArrowLeft size={15} />再读一遍情境</button>
    </section>}
    {finalEnding ? <section className="vn-end"><p className="vn-kicker">{g.previewEnding?'终章预览 · 基于已有经历':'终章'}</p><h2>{finalEnding.name}</h2><p className="vn-ending-copy" onClick={()=>endReading.advance()}>{endReading.visible}</p><p className="vn-ending-subtitle">{finalEnding.subtitle}</p><button className="vn-text-button" onClick={speech.replay} disabled={speech.status==='loading'}><Volume2 size={16}/>{speech.status==='loading'?'连接语音…':'重听结语'}</button><button disabled={aiBusy} onClick={() => setPanel('journal')}>翻开人生回忆 <BookOpen size={18} /></button><button className="vn-text-button" onClick={()=>setG(jumpToEnding)}>重新回望</button><button className="vn-text-button" onClick={restart}>重新开始</button></section> : finished ? <section className="vn-end vn-end-wait" aria-live="polite"><p className="vn-kicker">铃声之后</p><h2>那些日子，慢慢浮现。</h2><p className="vn-ending-copy">{generated.status==='error'?'这封写给你的结语，暂时没能送达。':'你走过的路，说过的话，正在汇成最后一页。'}</p>{generated.status==='error'&&<><button onClick={generated.retry}>再试一次</button><button className="vn-text-button" onClick={generated.useOriginal}>阅读原稿结尾</button></>}</section> : !choosing && <section className="vn-dialogue" aria-label={remembering?'精选回忆':'剧情对话'}>
      <div className="vn-dialogue-top"><span className="vn-speaker">{remembering?'那些记得的瞬间':cue.speaker}<small>{remembering?'回望':g.phase === 'ai' ? '对你的回应' : g.phase === 'branch' ? `选择 ${ch.choices[g.picks[ch.id] ?? 0].id} · 后续` : g.phase === 'common' ? '故事继续' : '物理教师篇'}</small></span><span className="vn-line-tools">{<><button className="vn-voice-button" onClick={speech.replay} disabled={speech.status==='loading'} aria-label="播放这句回应"><Volume2 size={16}/>{({idle:'播放语音',loading:'生成语音…',playing:'重听',ready:'重听',blocked:'点击播放',error:'重试语音'})[speech.status]}</button><button className="vn-voice-button" onClick={speech.toggle} aria-label={speech.muted?'开启自动语音':'关闭自动语音'}>{speech.muted?<VolumeX size={16}/>:<Volume2 size={16}/>}</button></>}{g.line + 1} / {remembering?Math.max(1,highlights.length):lines.length}</span></div>
      <p className={`vn-reading ${!remembering&&paragraph.length>120?'vn-reading-dense':''}`} onClick={next}><span aria-hidden="true">{reading.visible}</span><span className="vn-sr-only" aria-live="polite">{reading.done?paragraph:''}</span></p>
      <div className="vn-dialogue-actions"><button className="vn-text-button" disabled={opening} onClick={previous}><ArrowLeft size={16} />上一句</button>
        {g.phase === 'intro' && <button className="vn-text-button vn-skip" onClick={() => setG({ ...g, phase: 'choice', line: 0 })}>前往选择 <ChevronDown size={16} /></button>}
        <button className="vn-next" onClick={()=>{if(remembering&&g.line===Math.max(1,highlights.length)-1){if(reading.advance())setG(revealEnding);}else next();}}>{remembering?(g.line+1<highlights.length?'继续回望':'翻开最后一页'):g.line + 1 === lines.length && g.phase === 'intro' ? '做出选择' : '继续'}<ArrowRight size={20} /></button>
      </div>
    </section>}
    <footer className="vn-footer"><span>{ready ? saved ? '进度已自动保存' : '本次进度暂未保存' : '读取进度…'}</span><span>{choosing ? '输入自己的想法，或按 1 / 2 / 3 选择' : '← 上一句 · → / 空格 下一句'}</span></footer>
    {overlays}
  </main></GameViewport>;
}

export default function GamePage(){return <StoryGame key={scriptSource.revision}/>;}
