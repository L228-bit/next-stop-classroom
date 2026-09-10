export type Stats = { craft: number; trust: number; purpose: number; energy: number };
export const statLabels: Record<keyof Stats, string> = { craft: '教学能力', trust: '学生信任', purpose: '职业认同', energy: '个人精力' };
export const initialStats: Stats = { craft: 40, trust: 40, purpose: 45, energy: 65 };
// New-script playtest values, in chapter order and A/B/C order.
// These are independent of the legacy game and can be balanced without editing prose.
export const effects: Partial<Stats>[][] = [
  [{craft:8,purpose:3,energy:-4},{craft:6,purpose:2,energy:-3},{craft:3,purpose:5,energy:2}],
  [{craft:3,trust:1,energy:-5},{craft:5,purpose:1,energy:-6},{craft:7,trust:7,purpose:3,energy:-4}],
  [{craft:6,trust:8,energy:-4},{craft:8,trust:4,energy:-3},{craft:5,trust:6,purpose:4,energy:-3}],
  [{trust:9,purpose:4,energy:-4},{craft:5,trust:7,energy:-3},{trust:5,purpose:3,energy:-2}],
  [{craft:9,trust:5,energy:-5},{craft:5,trust:8,purpose:4,energy:-3},{craft:7,trust:4,energy:-4}],
  [{craft:10,purpose:4,energy:-12},{trust:7,purpose:3,energy:-3},{craft:5,trust:5,energy:5}],
  [{trust:7,purpose:5,energy:-3},{craft:3,trust:5,purpose:4,energy:-2},{trust:9,purpose:4,energy:-3}],
  [{energy:15,purpose:3},{energy:12,trust:2,purpose:4},{energy:10,purpose:5}],
  [{trust:8,purpose:4},{craft:8,purpose:6,energy:-8},{energy:12,purpose:5}],
];
const activeChapterIds = ['01', '02', '03', '04', '06', '08', '09'];
const effectScale = 9 / 7;
export function statsFor(picks: Record<string, number>): Stats {
  const stats = { ...initialStats };
  for (const id of activeChapterIds) {
    const pick = picks[id];
    if (!Number.isInteger(pick) || pick < 0 || pick > 2) continue;
    // Keep effects attached to source chapter IDs, including gaps in the new script.
    const effect = effects[Number(id) - 1][pick];
    for (const key of Object.keys(effect) as (keyof Stats)[]) stats[key] = Math.max(0, Math.min(100, stats[key] + Math.round((effect[key] ?? 0) * effectScale)));
  }
  return stats;
}
export function endingFor(stats: Stats) {
  if (stats.energy < 35)
    return {
      id: 'E1', name: '重新找回自己',
      subtitle: '这一回，也把时间留给自己。',
      text: '退休后的第一个早晨，你醒得仍然很早。伸手找教案时，才想起今天不用上课。你坐了一会儿，打开窗，让风进来。那些认真过的日子不会因为疲惫而失去意义，而往后的日子，也不必再用忙碌来证明。陈应又发来吃饭的邀请，这次你回了一个“好”。',
    };
  if (stats.trust >= 82)
    return {
      id: 'E2', name: '桃李来信',
      subtitle: '有些回答，会在很多年后抵达。',
      text: '搬回家的纸箱里，最沉的不是教案。学生的明信片、折了角的合照，还有一页保存很久的草稿纸，占去了大半空间。你不是每个人记忆里最厉害的老师，但有些人在不知如何继续时，仍记得你愿意等一等。窗边的手机亮起来，又有一个毕业许久的名字发来：“老师，最近好吗？”',
    };
  if (stats.craft >= 85)
    return {
      id: 'E3', name: '薪火相传',
      subtitle: '下一次铃响，有人接着往下讲。',
      text: '年轻教师发来一段课堂记录。她用了你留下的材料，又换上新的例子。你看着看着笑了：那个你试过许多次的问题，在她的班上得到了从没听过的回答。你关掉手机，没有再补充意见。讲台已经有了新的声音，而你的那些尝试，正在别人的尝试里继续生长。',
    };
  return {
    id: 'E4', name: '平凡而长久',
    subtitle: '你曾认真地，站在这里。',
    text: '没有盛大的告别，只有熟悉的同事、几束花和一张合影。回家的路和平时一样，你却第一次慢慢走完。你记得很多普通的下午，很多终于听懂的表情，也记得自己做得不够好的时候。那些并不完美的日子拼在一起，就是你实实在在走过的一生。',
  };
}
