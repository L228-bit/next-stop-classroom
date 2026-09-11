'use client';
import {useRef,useState,useEffect} from 'react';
import {Settings,X} from 'lucide-react';
export default function ResetControl({onReset,onRestore,onOpenChange}:{onReset:()=>void;onRestore:()=>void;onOpenChange?:(open:boolean)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);const [volume,setVolume]=useState('1'),[speed,setSpeed]=useState('1'),[muted,setMuted]=useState(false);
 useEffect(()=>{try{setVolume(localStorage.getItem('vn-volume')??'1');setSpeed(localStorage.getItem('vn-text-speed')??'1');setMuted(localStorage.getItem('next-stop-classroom-speech-muted')==='true');}catch{}},[]);
 function save(key:string,value:string){try{localStorage.setItem(key,value);}catch{}window.dispatchEvent(new Event('vn-preferences'));}
 function close(){dialog.current?.close();}
 return <><button className="vn-settings-trigger" onClick={()=>{dialog.current?.showModal();onOpenChange?.(true);}}><Settings size={17}/>设置</button><dialog ref={dialog} className="vn-reset-dialog" onClose={()=>onOpenChange?.(false)}>
 <header><h2>阅读与声音</h2><button aria-label="关闭设置" onClick={close}><X size={21}/></button></header>
 <section className="vn-preferences">
 <label>自动语音<input type="checkbox" checked={!muted} onChange={e=>{setMuted(!e.target.checked);save('next-stop-classroom-speech-muted',String(!e.target.checked));}}/></label>
 <label>音量<input aria-label="音量" type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>{setVolume(e.target.value);save('vn-volume',e.target.value);}}/></label>
 <label>文字速度<select value={speed} onChange={e=>{setSpeed(e.target.value);save('vn-text-speed',e.target.value);}}><option value="0.75">慢</option><option value="1">标准</option><option value="1.5">快</option></select></label>
 <p>空格 / →：补全或继续　←：上一句<br/>Tab：选择按钮　Enter：确认　Esc：关闭窗口<br/>选择页按 1 / 2 / 3；输入时空格正常输入。</p>
 </section><div><button className="vn-reset-cancel" onClick={()=>{close();onRestore();}}>恢复上一局备份</button><button className="vn-reset-confirm" onClick={()=>{onReset();close();}}>清空并重新开始</button></div>
 </dialog></>;
}
