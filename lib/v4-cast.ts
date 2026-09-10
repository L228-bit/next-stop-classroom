export type Side = 'left' | 'right';
export type Character = { name: string; role: string; image: string; facing: Side; side: Side; chroma?: boolean };
const existing = (name: string, role: string, image: string): Character => ({name, role, image: `/characters/cutouts/${image}`, facing:'right', side:'right'});
const added = (name: string, role: string, image: string, side: Side = 'right'): Character => ({name, role, image:`/characters/portraits/${image}.png`, facing:'right', side, chroma:true});
export const cast: Character[] = [
  existing('陈应','物理老师 · 带教师傅','chen-ying.png'),
  existing('徐进','语文老师 · 同事','xu-jin-v2.png'),
  existing('吴国平','语文老师 · 同事','wu-guoping-v2.png'),
  existing('张龙','教导主任','zhang-long.png'),
  existing('笑笑','高中生','xiaoxiao-v1.png'),
  added('学生','高中生','student-v2'),
  added('同桌','高中生','student-v2'),
  added('家长','学生家长','parent-v2'),
  added('孩子','你的孩子 · 中学生','child-v2'),
  added('小孩','开放日的小访客','young-child-v2'),
  added('旁白','故事的讲述者','narrator-v2','left'),
  added('你','物理老师','player-v2','left'),
];
export function characterFor(speaker: string, chapter: number): Character {
  const person = cast.find(person=>person.name===speaker) ?? cast.find(person=>person.name==='旁白')!;
  if(speaker==='你' && chapter>=7) return {...person,image:`/characters/portraits/player-${chapter>=8?60:43}.png`};
  return person;
}
// The person looks into the scene. Mirroring depends on native gaze and position,
// never on the line number, so advancing dialogue does not randomly flip them.
export function mirrorFor(person: Character, side: Side): boolean {
  return person.facing !== (side==='left'?'right':'left');
}
