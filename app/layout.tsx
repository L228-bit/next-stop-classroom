import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '下一站，讲台 · 教师人生模拟器',
  icons: { icon: '/favicon.svg' },
  description: '从第一堂物理课到退休，在九个人生章节中做出自己的选择。',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
