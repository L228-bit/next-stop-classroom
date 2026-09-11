'use client';
import {useRef,useState,useEffect} from 'react';
import {Settings,X} from 'lucide-react';
import {DASH_SCOPE_KEY_STORAGE} from '@/lib/client-api-key';
export default function ResetControl({onReset,onRestore,onOpenChange}:{onReset:()=>void;onRestore:()=>void;onOpenChange?:(open:boolean)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);const [volume,setVolume]=useState('1'),[speed,setSpeed]=useState('1'),[muted,setMuted]=useState(false),[rate,setRate]=useState('1'),[apiKey,setApiKey]=useState(''),[apiSaved,setApiSaved]=useState(false);
 useEffect(()=>{try{setRate(localStorage.getItem('vn-speech-rate')??'1');setVolume(localStorage.getItem('vn-volume')??'1');setSpeed(localStorage.getItem('vn-text-speed')??'1');setMuted(localStorage.getItem('next-stop-classroom-speech-muted')==='true');const value=localStorage.getItem(DASH_SCOPE_KEY_STORAGE)??'';setApiKey(value);setApiSaved(!!value);}catch{}},[]);
 function save(key:string,value:string){try{localStorage.setItem(key,value);}catch{}window.dispatchEvent(new Event('vn-preferences'));}
 function changeRate(value:string){setRate(value);const n=Number(value);if(value&&Number.isFinite(n)&&n>=0.5&&n<=2.5)save('vn-speech-rate',String(n));}
 function saveApiKey(){const value=apiKey.trim();if(!/^sk-[A-Za-z0-9._-]{20,200}$/.test(value))return;try{localStorage.setItem(DASH_SCOPE_KEY_STORAGE,value);setApiKey(value);setApiSaved(true);}catch{}window.dispatchEvent(new Event('vn-api-key'));}
 function clearApiKey(){try{localStorage.removeItem(DASH_SCOPE_KEY_STORAGE);}catch{}setApiKey('');setApiSaved(false);window.dispatchEvent(new Event('vn-api-key'));}
 function close(){dialog.current?.close();}
 return <><button className="vn-settings-trigger" onClick={()=>{dialog.current?.showModal();onOpenChange?.(true);}}><Settings size={17}/>设置</button><dialog ref={dialog} className="vn-reset-dialog" onClose={()=>onOpenChange?.(false)}>
 <header><h2>阅读与声音</h2><button aria-label="关闭设置" onClick={close}><X size={21}/></button></header>
 <section className="vn-preferences">
 <label>自动语音<input type="checkbox" checked={!muted} onChange={e=>{setMuted(!e.target.checked);save('next-stop-classroom-speech-muted',String(!e.target.checked));}}/></label>
 <label>音量<input aria-label="音量" type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>{setVolume(e.target.value);save('vn-volume',e.target.value);}}/></label>
 <div className="vn-rate-setting"><span>全局语速</span><input aria-label="全局语速滑条" type="range" min="0.5" max="2.5" step="0.05" value={Number(rate)||1} onChange={e=>changeRate(e.target.value)}/><input aria-label="全局语速倍数" type="number" min="0.5" max="2.5" step="0.05" value={rate} onChange={e=>changeRate(e.target.value)} onBlur={()=>changeRate(String(Math.min(2.5,Math.max(0.5,Number(rate)||1))))}/><span>倍</span></div>
 <label>文字速度<select value={speed} onChange={e=>{setSpeed(e.target.value);save('vn-text-speed',e.target.value);}}><option value="0.75">慢</option><option value="1">标准</option><option value="1.5">快</option></select></label>
 <div className="vn-api-setting"><label htmlFor="dashscope-key">阿里云百炼 API Key</label><input id="dashscope-key" type="password" autoComplete="new-password" spellCheck={false} placeholder="sk-..." value={apiKey} onChange={e=>{setApiKey(e.target.value);setApiSaved(false);}}/><div><button type="button" onClick={saveApiKey} disabled={!/^sk-[A-Za-z0-9._-]{20,200}$/.test(apiKey.trim())}>保存</button><button type="button" onClick={clearApiKey} disabled={!apiKey&&!apiSaved}>清除</button><span aria-live="polite">{apiSaved?'已保存在此浏览器':''}</span></div><p>仅支持阿里云百炼（DashScope）API Key。密钥只保存在此浏览器，不会写入游戏存档或上传到 GitHub。</p></div>
 <p>空格 / →：补全或继续　←：上一句<br/>Tab：选择按钮　Enter：确认　Esc：关闭窗口<br/>选择页按 1 / 2 / 3；输入时空格正常输入。</p>
 </section><div><button className="vn-reset-cancel" onClick={()=>{close();onRestore();}}>恢复上一局备份</button><button className="vn-reset-confirm" onClick={()=>{onReset();close();}}>清空并重新开始</button></div>
 </dialog></>;
}
