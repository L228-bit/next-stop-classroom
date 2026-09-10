'use client';
import { useEffect, useState, type ReactNode } from 'react';
export default function GameViewport({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState<number | null>(null);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1280, window.innerHeight / 720));
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return <div className="vn-letterbox"><div className="vn-frame" style={{transform:`translate(-50%, -50%) scale(${scale ?? 1})`,visibility:scale===null?'hidden':'visible'}}>{children}</div></div>;
}
