import story from './story-v4.json';
import direction from './story-v4-direction.json';
import type { Progress } from './v4-flow';

export type Memory = { id: string; chapter: number; title: string; time: string; source: 'custom' | 'preset'; text: string; reply: string; scene: string; speaker: string };
export function memoriesFor(g: Pick<Progress,'picks'|'answers'>): Memory[] {
  return story.flatMap((ch, chapter) => {
    const choice = ch.choices[g.picks[ch.id]];
    if (!choice) return [];
    const answer = g.answers?.[ch.id];
    const cues = (direction as Record<string,Record<string,{scene:string;speaker:string}[]>>)[ch.id][choice.id];
    return [{id:ch.id,chapter,title:ch.title,time:ch.time,source:answer?'custom' as const:'preset' as const,text:answer?.text??choice.label,reply:answer?.reply??choice.lines[0],scene:cues[0].scene,speaker:answer?.speaker??cues[0].speaker}];
  });
}
function evenly<T>(items:T[], count:number):T[] {
  if(count<=0) return [];
  if(items.length<=count) return items;
  if(count===1) return [items[Math.floor((items.length-1)/2)]];
  return Array.from({length:count},(_,i)=>items[Math.round(i*(items.length-1)/(count-1))]);
}
export function selectedMemories(g: Pick<Progress,'picks'|'answers'>): Memory[] {
  const all=memoriesFor(g);
  const custom=all.filter(m=>m.source==='custom');
  return [...evenly(custom,4),...evenly(all.filter(m=>m.source==='preset'),Math.max(0,4-custom.length))].sort((a,b)=>a.chapter-b.chapter);
}
// Presentation only: original answers remain untouched in the save and detail view.
export function briefReply(reply:string):string {
  const firstSentence=reply.match(/^[\s\S]*?[。！？!?](?:[”」])?/u)?.[0]??reply;
  return Array.from(firstSentence).slice(0,90).join('')+(Array.from(firstSentence).length>90?'…':'');
}
export function memoryPassage(memory:Memory):string {
  return `${memory.source==='custom'?'你写下：':'你选择：'}\n${memory.text.replace(/\s+/g,' ')}\n\n${briefReply(memory.reply).replace(/\s+/g,' ')}`;
}
