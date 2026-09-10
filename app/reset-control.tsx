'use client';
import { useRef } from 'react';
import { Settings, RotateCcw, X } from 'lucide-react';
export default function ResetControl({ onReset, onOpenChange }: { onReset: () => void; onOpenChange?: (open:boolean)=>void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className="vn-settings-trigger" onClick={()=>{dialog.current?.showModal();onOpenChange?.(true);}}><Settings size={17}/>设置</button>
    <dialog ref={dialog} className="vn-reset-dialog" onClose={()=>onOpenChange?.(false)}>
      <header><h2>重新开始</h2><button aria-label="关闭设置" onClick={()=>dialog.current?.close()}><X size={21}/></button></header>
      <p>清除这局的进度、选择、自由回答和剧情记忆，从第一章重新开始。</p>
      <div><button className="vn-reset-cancel" onClick={()=>dialog.current?.close()}>保留，继续游戏</button><button className="vn-reset-confirm" onClick={()=>{dialog.current?.close();onReset();}}><RotateCcw size={17}/>清除记录，重新开始</button></div>
    </dialog>
  </>;
}
