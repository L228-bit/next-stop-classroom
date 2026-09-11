'use client';
import {useState} from 'react';
import {ArrowLeft,RotateCcw} from 'lucide-react';
import {type Memory} from '@/lib/v4-memory';
import {scenes} from '@/lib/v4-scenes';
export default function MemoryBoard({memories,onRechoose}:{memories:Memory[];onRechoose:(chapter:number)=>void}) {
  const [selected,setSelected]=useState<string|null>(null);
  const memory=memories.find(m=>m.id===selected);
  if(!memories.length)return <p className="vn-memory-empty">你的选择和亲手写下的话，会留在这里。</p>;
  if(memory)return <section className="vn-memory-detail" aria-label={`${memory.title}的回忆`}>
    <div className="vn-memory-photo" style={{backgroundImage:`url(/art/${scenes[memory.scene].image}.png)`}}><span>{memory.time}</span></div>
    <div className="vn-memory-detail-copy"><small>第 {String(memory.chapter+1).padStart(2,'0')} 章</small><h3>{memory.title}</h3>
      <p className="vn-memory-label">{memory.source==='custom'?'当时，你写下':'当时，你选择'}</p><p className="vn-memory-original">{memory.text}</p>
      <blockquote><small>{memory.speaker}的回应</small><br/>{memory.reply}</blockquote>
      <div className="vn-memory-detail-actions"><button className="vn-text-button" onClick={()=>setSelected(null)}><ArrowLeft size={16}/>全部回忆</button><button className="vn-text-button" onClick={()=>onRechoose(memory.chapter)}><RotateCcw size={14}/>重选这一章</button></div>
    </div>
  </section>;
  return <div className="vn-memory-grid">{memories.map(memory=><button key={String(memory.chapter+1).padStart(2,'0')} className="vn-memory-tile" onClick={()=>setSelected(memory.id)}>
    <span className="vn-memory-tile-image" style={{backgroundImage:`url(/art/${scenes[memory.scene].image}.png)`}}/>
    <small>{String(memory.chapter+1).padStart(2,'0')} · {memory.title}</small><p>{memory.text}</p><span className="vn-memory-source">{memory.source==='custom'?'亲手写下':'当时的选择'}</span>
  </button>)}</div>;
}
