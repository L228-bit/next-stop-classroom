import story from './story-v4.json';
import { selectedMemories } from './v4-memory';
import type { GeneratedEnding } from './v4-ending';
export type CustomAnswer = { text: string; reply: string; speaker: string; choice: number };
export type Progress = { chapter: number; phase: 'opening' | 'chapter' | 'intro' | 'choice' | 'ai' | 'branch' | 'common' | 'epilogue' | 'recollection' | 'end'; line: number; picks: Record<string, number>; answers?: Record<string, CustomAnswer>; recollectionDone?: boolean; openingSeen?: boolean; previewEnding?: boolean; generatedEnding?: GeneratedEnding };
export const initial: Progress = { chapter: 0, phase: 'opening', line: 0, picks: {}, answers: {}, openingSeen: false };
export function linesFor(g: Progress): string[] {
  const ch = story[g.chapter];
  if (g.phase === 'branch') return ch.choices[g.picks[ch.id] ?? 0].lines;
  if (g.phase === 'common') return ch.common;
  if (g.phase === 'ai') return [g.answers?.[ch.id]?.reply ?? ''];
  return ch.intro;
}
export function valid(value: unknown): value is Progress {
  if (!value || typeof value !== 'object') return false;
  const g = value as Progress;
  if (!Number.isInteger(g.chapter) || g.chapter < 0 || g.chapter >= story.length || !['opening','chapter','intro','choice','ai','branch','common','epilogue','recollection','end'].includes(g.phase) || !Number.isInteger(g.line) || g.line < 0 || !g.picks || typeof g.picks !== 'object' || Array.isArray(g.picks)) return false;
  if (!Object.entries(g.picks).every(([id, n]) => story.some(c => c.id === id) && Number.isInteger(n) && n >= 0 && n < 3)) return false;
  if (g.answers !== undefined && (!g.answers || typeof g.answers !== 'object' || Array.isArray(g.answers) || !Object.entries(g.answers).every(([id,a]) => a && typeof a.text === 'string' && a.text.length <= 200 && typeof a.reply === 'string' && a.reply.length <= 400 && typeof a.speaker === 'string' && a.speaker.length <= 20 && a.choice === g.picks[id]))) return false;
  if (g.recollectionDone !== undefined && typeof g.recollectionDone !== 'boolean') return false;
  if(g.openingSeen!==undefined&&typeof g.openingSeen!=='boolean'||g.previewEnding!==undefined&&typeof g.previewEnding!=='boolean')return false;
  if(g.generatedEnding!==undefined&&(!g.generatedEnding||typeof g.generatedEnding.text!=='string'||g.generatedEnding.text.length>220||typeof g.generatedEnding.fingerprint!=='string'||g.generatedEnding.fingerprint.length>50))return false;
  if(g.phase==='opening')return g.chapter===0&&g.line<2;
  if (['end','epilogue','recollection'].includes(g.phase)) {
    if (g.chapter !== story.length - 1 || (!g.previewEnding&&!story.every(c=>g.picks[c.id] !== undefined))) return false;
    if (g.phase==='end') return g.recollectionDone===true;
    return g.phase==='epilogue' ? g.line===0 : g.line<Math.max(1,selectedMemories(g).length);
  }
  if (['branch','common','ai'].includes(g.phase) && g.picks[story[g.chapter].id] === undefined) return false;
  if (g.phase === 'ai' && !g.answers?.[story[g.chapter].id]) return false;
  return g.phase === 'chapter' || g.phase === 'choice' || g.line < linesFor(g).length;
}
export function restoreProgress(value:unknown):Progress|null {
  if(!value||typeof value!=='object')return null;
  const g=value as Progress;
  if(g.phase==='chapter'&&g.chapter===0&&g.openingSeen===undefined&&g.picks&&Object.keys(g.picks).length===0)return valid(g)?{...g,phase:'opening',line:0,openingSeen:false}:null;
  const restored=g.phase==='end'&&g.recollectionDone!==true?{...g,phase:'epilogue' as const,line:0,recollectionDone:false}:g;
  return valid(restored)?restored:null;
}
export function confirmInterlude(g:Progress):Progress {
  if(g.phase==='opening')return g.line===0?{...g,line:1}:{...g,phase:'chapter',line:0,openingSeen:true};
  if(g.phase==='chapter')return {...g,phase:'intro',line:0};
  if(g.phase==='epilogue'&&valid(g))return {...g,phase:'recollection',line:0,recollectionDone:false};
  return g;
}
export function revealEnding(g:Progress):Progress {
  return g.phase==='recollection'&&valid(g)&&g.line===Math.max(1,selectedMemories(g).length)-1?{...g,phase:'end',line:0,recollectionDone:true}:g;
}
function afterChapter(g: Progress): Progress {
  if (g.chapter < story.length - 1) return { ...g, chapter: g.chapter + 1, phase: 'chapter', line: 0 };
  const missing = story.findIndex(c=>g.picks[c.id] === undefined);
  return missing >= 0 ? { ...g, chapter: missing, phase:'chapter', line:0 } : { ...g, phase: 'epilogue', line: 0, recollectionDone:false };
}
export function advance(g: Progress): Progress {
  if (['opening','chapter','choice','epilogue','end'].includes(g.phase)) return g;
  if (g.phase==='recollection')return g.line+1<selectedMemories(g).length?{...g,line:g.line+1}:g;
  if (g.phase === 'ai') return {...g,phase:'branch',line:0};
  if (g.line + 1 < linesFor(g).length) return {...g,line:g.line+1};
  if (g.phase === 'intro') return {...g,phase:'choice',line:0};
  if (g.phase === 'branch' && story[g.chapter].common.length) return {...g,phase:'common',line:0};
  return afterChapter(g);
}
export function back(g: Progress): Progress {
  if(g.phase==='opening')return {...g,line:0};
  if (g.phase === 'chapter' || g.phase === 'end') return g;
  if (g.phase==='recollection')return g.line>0?{...g,line:g.line-1}:{...g,phase:'epilogue',line:0};
  if (g.phase === 'epilogue') { if(g.picks[story[g.chapter].id]===undefined)return {...g,phase:'chapter',line:0}; const p:Progress={...g,phase:'branch'}; return {...p,line:linesFor(p).length-1}; }
  if (g.phase === 'choice' || g.phase === 'ai') return {...g,phase:'intro',line:story[g.chapter].intro.length-1};
  if (g.line > 0) return {...g,line:g.line-1};
  if (g.phase === 'branch') return {...g,phase:g.answers?.[story[g.chapter].id]?'ai':'choice',line:0};
  if (g.phase === 'common') {const p:Progress={...g,phase:'branch'};return {...p,line:linesFor(p).length-1};}
  return {...g,phase:'chapter',line:0};
}
export function pick(g: Progress, index: number, answer?: CustomAnswer): Progress {
  if (g.phase !== 'choice' || !Number.isInteger(index) || index < 0 || index > 2) return g;
  const id=story[g.chapter].id;
  return {...g,phase:answer?'ai':'branch',line:0,recollectionDone:false,previewEnding:false,generatedEnding:undefined,picks:{...Object.fromEntries(Object.entries(g.picks).filter(([k])=>Number(k)<Number(id))),[id]:index},answers:{...Object.fromEntries(Object.entries(g.answers??{}).filter(([k])=>Number(k)<Number(id))),...(answer?{[id]:answer}:{})}};
}

// Navigation never invents or deletes choices. Rechoosing still replaces downstream history.
export function jumpToChapter(g:Progress, chapter:number):Progress {
  if(!Number.isInteger(chapter)||chapter<0||chapter>=story.length)return g;
  return {...g,chapter,phase:'chapter',line:0,openingSeen:true,previewEnding:false,recollectionDone:false};
}
export function jumpToEnding(g:Progress):Progress {
  return {...g,chapter:story.length-1,phase:'epilogue',line:0,openingSeen:true,previewEnding:!story.every(c=>g.picks[c.id]!==undefined),recollectionDone:false};
}
