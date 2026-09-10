'use client';
/* Synchronize browser-only storage and the typewriter clock after hydration. No React compiler is enabled. */
/* eslint-disable react/react-compiler */
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Feather,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Volume2,
  VolumeX,
  X,
  Download,
  Upload,
  Check,
  Leaf,
} from 'lucide-react';
import {
  chapters,
  freshGame,
  getLines,
  advance,
  applyChoice,
  suggest,
  ending,
  decodeSave,
  statLabels,
  type Game,
  type Stats,
  type Entry,
} from '../../lib/game';
const SAVE = 'teacher-life-v1';
const PREFS = 'teacher-life-prefs-v1';
export default function Home() {
  const [game, setGame] = useState<Game | null>(null);
  const [saved, setSaved] = useState<Game | null>(null);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<'journal' | 'settings' | 'restart' | null>(
    null,
  );
  const [input, setInput] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [suggested, setSuggested] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [online, setOnline] = useState(false);
  const [mode, setMode] = useState<'offline' | 'ai'>('offline');
  const [sound, setSound] = useState(false);
  const [large, setLarge] = useState(false);
  const [auto, setAuto] = useState(false);
  const [full, setFull] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [visibleChars, setVisibleChars] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const audioTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(game);
  useEffect(() => {
    stateRef.current = game;
  }, [game]);
  useEffect(() => {
    if (panel && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [panel]);
  const ch = game ? chapters[game.chapter] : null;
  const entry = game?.entries[game.entries.length - 1];
  const end = game?.phase === 'ending' ? ending(game) : null;
  const current =
    game && ch
      ? game.phase === 'story'
        ? getLines(game)[game.line]
        : game.phase === 'result'
          ? {
              who: game.resultLine === 0 ? '回应' : '旁白',
              text:
                game.resultLine === 0
                  ? entry?.response || ''
                  : ch.choices[entry?.choice ?? 0].after,
            }
          : null
      : null;
  const text = current?.text || '';
  const typing = visibleChars < text.length;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE);
      if (raw) {
        const parsed = decodeSave(raw);
        setSaved(parsed);
        if (!parsed)
          setNotice('这份存档无法读取。你仍然可以开始新的故事，或导入备份。');
      }
      const prefs = JSON.parse(localStorage.getItem(PREFS) || '{}');
      setLarge(!!prefs.large);
      if (prefs.mode === 'ai') setMode('ai');
    } catch {
      setSaveError(true);
    }
    setReduceMotion(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    setReady(true);
    fetch('/api/status')
      .then((r) => r.json())
      .then((d) =>
        setOnline(
          !!d &&
            typeof d === 'object' &&
            'available' in d &&
            d.available === true,
        ),
      )
      .catch(() => setOnline(false));
  }, []);
  useEffect(() => {
    if (!game) return;
    try {
      localStorage.setItem(SAVE, JSON.stringify(game));
      setSaved(game);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [game]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(PREFS, JSON.stringify({ large, mode }));
      } catch {}
  }, [large, mode, ready]);
  useEffect(() => {
    setVisibleChars(reduceMotion ? text.length : 0);
    if (reduceMotion) return;
    const timer = setInterval(
      () => setVisibleChars((n) => Math.min(text.length, n + 2)),
      22,
    );
    return () => clearInterval(timer);
  }, [text, reduceMotion]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (game?.phase === 'choice') {
      setInput('');
      setConfirmText('');
      setSuggested(null);
    }
  }, [game?.chapter, game?.phase]);
  const next = useCallback(() => {
    if (panel || busy) return;
    if (typing) {
      setVisibleChars(text.length);
      return;
    }
    setGame((g) => (g ? advance(g) : g));
  }, [panel, busy, typing, text.length]);
  useEffect(() => {
    if (
      !auto ||
      typing ||
      panel ||
      busy ||
      !game ||
      !['story', 'result'].includes(game.phase)
    )
      return;
    const timer = setTimeout(
      () => setGame((g) => (g ? advance(g) : g)),
      Math.max(2400, text.length * 65),
    );
    return () => clearTimeout(timer);
  }, [auto, typing, panel, busy, game, text]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanel(null);
        setAuto(false);
        return;
      }
      if (
        (e.key === ' ' || e.key === 'Enter') &&
        !e.isComposing &&
        !(
          e.target instanceof HTMLElement &&
          ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(e.target.tagName)
        )
      ) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [next]);
  useEffect(() => {
    const changed = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  useEffect(() => {
    return () => {
      if (audioTimer.current) clearInterval(audioTimer.current);
      void audioRef.current?.close();
    };
  }, []);
  function toggleSound() {
    if (sound) {
      if (audioTimer.current) clearInterval(audioTimer.current);
      void audioRef.current?.suspend();
      setSound(false);
      return;
    }
    try {
      const ctx = audioRef.current ?? new AudioContext();
      audioRef.current = ctx;
      void ctx.resume();
      const notes = [261.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66];
      let n = 0;
      const play = () => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = notes[n++ % notes.length] / 2;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.5);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 3.6);
      };
      play();
      audioTimer.current = setInterval(play, 1800);
      setSound(true);
    } catch {
      setNotice('此浏览器暂时无法播放声音。');
    }
  }
  function start() {
    setGame(freshGame());
    setPanel(null);
    setAuto(false);
    setInput('');
    setConfirmText('');
  }
  function choose(
    index: number,
    source: Entry['source'] = 'choice',
    original = '',
    reply?: string,
  ) {
    if (lock.current) return;
    lock.current = true;
    setGame((g) =>
      g && g.phase === 'choice'
        ? applyChoice(g, index, original, source, reply)
        : g,
    );
    setConfirmText('');
    setInput('');
    setTimeout(() => {
      lock.current = false;
    }, 100);
  }
  async function send() {
    const value = input.trim();
    if (
      !value ||
      value.length > 200 ||
      busy ||
      !game ||
      game.phase !== 'choice'
    )
      return;
    setAuto(false);
    if (mode === 'ai' && online) {
      setBusy(true);
      try {
        const response = await fetch('/api/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapter: game.chapter,
            text: value,
            history: game.entries
              .map((e) => ({ chapter: e.chapter, choice: e.choice }))
              .slice(-4),
          }),
          signal: AbortSignal.timeout(18000),
        });
        if (!response.ok) throw new Error('unavailable');
        const result = (await response.json()) as {
          choice: number;
          reply: string;
        };
        if (
          !Number.isInteger(result.choice) ||
          result.choice < 0 ||
          result.choice > 2 ||
          typeof result.reply !== 'string' ||
          !result.reply.trim() ||
          result.reply.length > 400
        )
          throw new Error('invalid');
        if (
          stateRef.current?.startedAt === game.startedAt &&
          stateRef.current.chapter === game.chapter &&
          stateRef.current.phase === 'choice'
        )
          choose(result.choice, 'ai', value, result.reply);
        setBusy(false);
        return;
      } catch {
        setNotice(
          '这次没有收到有效的 AI 回应。请确认你的意思，故事仍然可以继续。',
        );
      } finally {
        setBusy(false);
      }
    }
    setConfirmText(value);
    setSuggested(suggest(game.chapter, value));
  }
  function exportSave() {
    const target = game ?? saved;
    if (!target) return;
    const blob = new Blob([JSON.stringify(target, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '下一站讲台-存档.json';
    a.click();
    URL.revokeObjectURL(url);
    setNotice('存档已导出。');
  }
  async function importSave(file: File) {
    if (file.size > 100000) {
      setNotice('存档文件过大，请选择游戏导出的 JSON 文件。');
      return;
    }
    const restored = decodeSave(await file.text());
    if (!restored) {
      setNotice('存档格式不正确或数据不完整，当前进度未改动。');
      return;
    }
    setGame(restored);
    setPanel(null);
    setAuto(false);
    setNotice('已恢复存档。');
  }
  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setNotice('可以使用 Safari 菜单中的“进入全屏幕”。');
    }
  }
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'read_teacher_story',
            description:
              'Read the current teacher-life game chapter, dialogue, available choices, and progress without changing anything.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: () => {
              const g = stateRef.current;
              return g
                ? {
                    chapter: g.chapter + 1,
                    title: chapters[g.chapter].title,
                    phase: g.phase,
                    dialogue: g.phase === 'story' ? getLines(g)[g.line] : null,
                    choices:
                      g.phase === 'choice'
                        ? chapters[g.chapter].choices.map((c, i) => ({
                            id: i,
                            text: c.label,
                          }))
                        : [],
                    memories: g.entries.map((e) => e.memory),
                  }
                : { status: 'title-screen' };
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, []);
  return (
    <main
      className={`game-shell ${game ? 'playing' : ''} ${large ? 'large-text' : ''} ${end ? 'ending-view' : ''}`}
    >
      <div
        key={ch?.background || 'title'}
        className={`scene-bg ${ch?.mood ?? ''}`}
        style={{
          backgroundImage: `url(/art/${game ? ch?.background : 'classroom'}.png)`,
        }}
      />
      <div className="scene-shade" />
      <div className="grain" aria-hidden="true" />
      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            if (!busy) {
              setGame(null);
              setAuto(false);
            }
          }}
          aria-label="返回标题，保留进度"
        >
          <span className="brand-mark">讲</span>下一站，讲台
          <span className="edition">教师人生模拟器</span>
        </button>
        <nav className="toolbar" aria-label="游戏菜单">
          <button
            className={sound ? 'active' : ''}
            onClick={toggleSound}
            aria-label={sound ? '关闭音乐' : '开启音乐'}
            title={sound ? '关闭音乐' : '开启音乐'}
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            onClick={() => setPanel('journal')}
            aria-label="人生手记"
            title="人生手记"
          >
            <BookOpen size={18} />
            <span>手记</span>
          </button>
          <button
            onClick={() => setPanel('settings')}
            aria-label="游戏设置"
            title="游戏设置"
          >
            <Settings size={18} />
          </button>
          <button
            className="fullscreen"
            onClick={toggleFull}
            aria-label={full ? '退出全屏' : '进入全屏'}
          >
            {full ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </nav>
      </header>
      {!game ? (
        <>
          <section className="title-screen">
            <p className="eyebrow">
              <span /> A LIFE BETWEEN THE LINES
            </p>
            <h1>
              下一站，
              <br />
              <em>讲台。</em>
            </h1>
            <p className="intro">
              那些写在黑板上的日子，
              <br />
              后来，都成为了谁的人生。
            </p>
            <div className="title-actions">
              <button
                className="start-button"
                disabled={!ready}
                onClick={() => (saved ? setPanel('restart') : start())}
              >
                翻开这一生
                <ArrowUpRight size={24} />
              </button>
              {saved && (
                <button
                  className="continue-button"
                  onClick={() => setGame(saved)}
                >
                  <Play size={15} />
                  继续上次的故事
                  <span>
                    {saved.phase === 'ending'
                      ? '查看结局'
                      : `第 ${saved.chapter + 1} 章`}
                  </span>
                </button>
              )}
            </div>
            <p className="title-meta">
              十个人生片段　 /　 约十五分钟　 /　 多种结局
            </p>
          </section>
          <div className="title-stamp">
            <span>一支粉笔</span>
            <span>许多人生</span>
          </div>
          <footer className="title-footer">
            <span>夏末 · 最后一节课之后</span>
            <span className="build-label">
              第一版 <i />{' '}
              {mode === 'ai' && online
                ? 'AI 对话已连接'
                : '离线故事 · 无需联网'}
            </span>
          </footer>
        </>
      ) : end ? (
        <section className="ending-card">
          <p className="eyebrow">THE CHALK FADES. THE STORY STAYS.</p>
          <div className="ending-symbol">
            <Leaf size={34} strokeWidth={1} />
          </div>
          <p className="ending-label">你的人生终章</p>
          <h1>{end.name}</h1>
          <p className="ending-subtitle">{end.subtitle}</p>
          <p className="ending-prose">{end.text}</p>
          <div className="ending-memories">
            {game.entries
              .filter((_, i) => [0, 2, 5, 9].includes(i))
              .map((e) => (
                <span key={e.chapter}>
                  <Feather size={13} />
                  {e.memory}
                </span>
              ))}
          </div>
          <div className="ending-actions">
            <button className="gold-button" onClick={() => setPanel('journal')}>
              <BookOpen size={17} />
              翻阅这一生
            </button>
            <button
              className="outline-button"
              onClick={() => setPanel('restart')}
            >
              <RotateCcw size={16} />
              再走一条路
            </button>
          </div>
          <p className="ending-footnote">
            这不是一份人生评分。你走过的每一步，都留下了痕迹。
          </p>
        </section>
      ) : (
        <>
          <section className="chapter-heading" key={game.chapter}>
            <p className="eyebrow">
              CHAPTER {String(game.chapter + 1).padStart(2, '0')}{' '}
              <span className="chapter-rule" />
            </p>
            <h2>{ch?.title}</h2>
            <p>
              {ch?.place} <i /> {ch?.season}
            </p>
          </section>
          <aside className="age-mark">
            <strong>{ch?.age}</strong>
            <span>岁 · 这一年的你</span>
          </aside>
          {game.phase === 'story' && current?.who === '许老师' && (
            <Image
              width={1024}
              height={1536}
              unoptimized
              className="character"
              src="/art/mentor.png"
              alt="带教老师许老师，手持绿色教案本站在窗边"
            />
          )}
          <div className="story-bottom">
            {game.phase === 'choice' ? (
              <section className="choice-panel" aria-labelledby="choice-title">
                <div className="choice-heading">
                  <span className="speaker-tag">
                    <Feather size={15} />
                    你的回答
                  </span>
                  <span className="choice-count">这一刻，由你决定</span>
                </div>
                <h3 id="choice-title">{ch?.question}</h3>
                <div className="answer-layout">
                  <div className="write-answer">
                    <label htmlFor="answer">
                      {confirmText ? '你刚才说' : '用自己的话说'}
                    </label>
                    {confirmText ? (
                      <>
                        <blockquote>{confirmText}</blockquote>
                        <p className="interpretation">
                          离线模式：请选择更接近你的意思。
                        </p>
                        <button
                          className="text-button"
                          onClick={() => {
                            setConfirmText('');
                            inputRef.current?.focus();
                          }}
                        >
                          重新写一句
                        </button>
                      </>
                    ) : (
                      <>
                        <textarea
                          ref={inputRef}
                          id="answer"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          maxLength={200}
                          disabled={busy}
                          placeholder="如果是你，会怎么说？"
                          onKeyDown={(e) => {
                            if (
                              e.key === 'Enter' &&
                              (e.metaKey || e.ctrlKey) &&
                              !e.nativeEvent.isComposing
                            ) {
                              e.preventDefault();
                              void send();
                            }
                          }}
                        />
                        <div className="input-footer">
                          <span>{input.length}/200</span>
                          <button
                            className="send-button"
                            disabled={!input.trim() || busy}
                            onClick={() => void send()}
                          >
                            {busy ? '正在倾听…' : '说完了'}
                            <ArrowRight size={16} />
                          </button>
                        </div>
                        <p className="mode-note">
                          {mode === 'ai' && online
                            ? 'AI 理解回应 · 文本会发送至 DeepSeek'
                            : '离线模式 · 写下回答后确认含义'}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="choices">
                    <p className="choices-label">
                      {confirmText ? '确认你的意思' : '也可以从这里开始'}
                    </p>
                    {ch?.choices.map((c, i) => (
                      <button
                        key={c.label}
                        disabled={busy}
                        className={`choice ${confirmText && suggested === i ? 'suggested' : ''}`}
                        onClick={() =>
                          choose(
                            i,
                            confirmText ? 'offline' : 'choice',
                            confirmText,
                          )
                        }
                      >
                        <span className="choice-letter">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span>
                          <strong>{c.label}</strong>
                          <small>{c.hint}</small>
                        </span>
                        <ChevronRight size={17} />
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <section className="dialogue-panel" aria-label="故事对白">
                <div className="dialogue-top">
                  <span className="speaker-tag">{current?.who}</span>
                  <span className="dialogue-counter">
                    {game.phase === 'result'
                      ? '选择之后'
                      : `${game.line + 1} / ${getLines(game).length}`}
                  </span>
                </div>
                {game.phase === 'result' && game.resultLine === 0 && (
                  <div className="your-words">你说：{entry?.input}</div>
                )}
                <button
                  className="dialogue-text"
                  onClick={next}
                  aria-label={typing ? '显示完整对白' : '继续故事'}
                >
                  <span aria-hidden="true">
                    {text.slice(0, visibleChars)}
                    {typing && <i className="typing-caret" />}
                  </span>
                  <span className="sr-only">{text}</span>
                </button>
                <div className="dialogue-footer">
                  {game.phase === 'result' && game.resultLine === 1 ? (
                    <span className="memory-earned">
                      <Feather size={14} />
                      留下回忆：{entry?.memory}
                    </span>
                  ) : (
                    <span className="read-hint">点击对白或按空格继续</span>
                  )}
                  <button className="next-button" onClick={next}>
                    {typing
                      ? '显示全部'
                      : game.phase === 'result' && game.resultLine === 1
                        ? game.chapter === 9
                          ? '走向终章'
                          : '走向下一年'
                        : '继续'}
                    <ChevronRight size={17} />
                  </button>
                </div>
              </section>
            )}
            <footer className="game-footer">
              <div
                className="timeline"
                aria-label={`人生进度，第${game.chapter + 1}章，共10章`}
              >
                {chapters.map((c, i) => (
                  <span
                    key={c.title}
                    className={
                      i === game.chapter
                        ? 'current'
                        : i < game.chapter
                          ? 'past'
                          : ''
                    }
                    title={i <= game.chapter ? c.title : '尚未抵达'}
                  >
                    <i />
                  </span>
                ))}
              </div>
              <span className="progress-label">
                {String(game.chapter + 1).padStart(2, '0')} / 10
              </span>
              <span className="autosave">
                {saveError ? (
                  '请导出存档备份'
                ) : (
                  <>
                    <Check size={13} />
                    已自动保存
                  </>
                )}
              </span>
              <button
                className={`auto-button ${auto ? 'active' : ''}`}
                onClick={() => setAuto(!auto)}
              >
                {auto ? <Pause size={13} /> : <Play size={13} />}自动阅读
              </button>
            </footer>
          </div>
        </>
      )}
      {notice && <output className="toast">{notice}</output>}
      {saveError && !game && (
        <p className="storage-warning">浏览器存储不可用，游玩后请导出存档。</p>
      )}
      {panel && (
        <dialog
          ref={dialogRef}
          aria-label={
            panel === 'journal'
              ? '人生手记'
              : panel === 'settings'
                ? '游戏设置'
                : '开始新故事'
          }
          className={`modal ${panel === 'journal' ? 'journal-modal' : ''}`}
          onCancel={() => setPanel(null)}
        >
          <button
            autoFocus
            className="close-modal"
            aria-label="关闭"
            onClick={() => setPanel(null)}
          >
            <X size={20} />
          </button>
          {panel === 'restart' ? (
            <>
              <p className="eyebrow">ANOTHER BEGINNING</p>
              <h2>重新翻开这一生？</h2>
              <p className="modal-description">
                新的故事会替换当前自动存档。你可以先导出这一段人生，留作纪念。
              </p>
              <div className="modal-actions">
                <button className="outline-button" onClick={exportSave}>
                  <Download size={16} />
                  导出旧存档
                </button>
                <button className="gold-button" onClick={start}>
                  开始新故事
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : panel === 'settings' ? (
            <>
              <p className="eyebrow">MAKE YOURSELF COMFORTABLE</p>
              <h2>阅读与存档</h2>
              <div className="setting-row">
                <div>
                  <strong>轻音乐</strong>
                  <p>缓慢的合成音符，默认关闭。</p>
                </div>
                <button
                  className={`switch ${sound ? 'on' : ''}`}
                  role="switch"
                  aria-checked={sound}
                  aria-label="轻音乐"
                  onClick={toggleSound}
                >
                  <i />
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <strong>大字号对白</strong>
                  <p>让每一句话更容易阅读。</p>
                </div>
                <button
                  className={`switch ${large ? 'on' : ''}`}
                  role="switch"
                  aria-checked={large}
                  aria-label="大字号对白"
                  onClick={() => setLarge(!large)}
                >
                  <i />
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <strong>自由输入模式</strong>
                  <p>
                    {online
                      ? 'DeepSeek 已配置。AI 模式会发送当前场景和你的输入。'
                      : '当前可使用离线模式；配置方式见项目说明。'}
                  </p>
                </div>
                <select
                  value={mode}
                  aria-label="自由输入模式"
                  onChange={(e) => setMode(e.target.value as 'offline' | 'ai')}
                >
                  <option value="offline">离线确认</option>
                  <option value="ai" disabled={!online}>
                    AI 理解{!online ? ' · 未配置' : ''}
                  </option>
                </select>
              </div>
              <div className="modal-actions">
                <button
                  className="outline-button"
                  disabled={!game && !saved}
                  onClick={exportSave}
                >
                  <Download size={16} />
                  导出存档
                </button>
                <button
                  className="outline-button"
                  onClick={() => importRef.current?.click()}
                >
                  <Upload size={16} />
                  导入存档
                </button>
              </div>
              <p className="settings-note">
                存档只保存在当前浏览器。导入存档会替换当前进度。
                <br />
                第一版 · 三条开局，十章故事，四种人生终章。
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow">THE THINGS WE KEEP</p>
              <h2>人生手记</h2>
              <p className="modal-description">
                路会汇合，走过的经历不会消失。
              </p>
              {(game ?? saved) ? (
                <>
                  <div className="stats">
                    {(Object.keys(statLabels) as (keyof Stats)[]).map((k) => (
                      <div key={k}>
                        <span>
                          {statLabels[k]}
                          <b>{(game ?? saved)!.stats[k]}</b>
                        </span>
                        <div className="stat-track">
                          <i
                            style={{ width: `${(game ?? saved)!.stats[k]}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="stats-note">
                    这些是故事状态，不是对你作为教师的评价。
                  </p>
                  <div className="journal-entries">
                    {(game ?? saved)!.entries.length === 0 ? (
                      <p className="empty-journal">
                        第一页还是空白。你的选择，会慢慢写满这里。
                      </p>
                    ) : (
                      (game ?? saved)!.entries.map((e) => (
                        <article key={e.chapter}>
                          <span className="journal-age">
                            {chapters[e.chapter].age}
                            <small>岁</small>
                          </span>
                          <div>
                            <p className="journal-chapter">
                              第 {e.chapter + 1} 章 ·{' '}
                              {chapters[e.chapter].title}
                            </p>
                            <h3>{e.memory}</h3>
                            <blockquote>“{e.input}”</blockquote>
                            <p>{chapters[e.chapter].choices[e.choice].after}</p>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                  <button className="outline-button" onClick={exportSave}>
                    <Download size={16} />
                    保存这段人生
                  </button>
                </>
              ) : (
                <p className="empty-journal">
                  故事还没有开始。
                  <br />
                  翻开这一生，把第一段回忆留在这里。
                </p>
              )}
            </>
          )}
        </dialog>
      )}
      <input
        ref={importRef}
        hidden
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importSave(file);
          e.target.value = '';
        }}
      />
    </main>
  );
}
