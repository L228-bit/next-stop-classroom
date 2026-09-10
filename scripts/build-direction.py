"""Import only the chapter body of the supplied revision, without rewriting prose."""
import re
import json
from pathlib import Path

source = Path('output/2026-09-10-最新用户稿.md')
text = source.read_text()
parts = re.split(r'^# (\d{2})　(.+?)\s*\{#c\d+\}\n', text, flags=re.M)
def clean(value):
    return re.sub(r'\s*\{#[^}]+\}', '', value).strip()
def paragraphs(value):
    return [clean(p) for p in re.split(r'\n[ \t]*\n', value.strip()) if clean(p)]
chapters = []
for i in range(1, len(parts), 3):
    chapter_id, title, body = parts[i:i+3]
    body = body.split('## 共同结局')[0]
    time = re.search(r'\*\*(.+?)\*\*', body).group(1)
    body = re.sub(r'^\s*\*\*.+?\*\*\s*', '', body, count=1)
    sections = re.split(r'^### (.+?)\n', body, flags=re.M)
    chapter = dict(id=chapter_id, title=title, time=time, intro=paragraphs(sections[0]), choices=[], common=[])
    for j in range(1, len(sections), 2):
        heading, body = sections[j:j+2]
        if heading.startswith('共同'):
            chapter['common'] = paragraphs(body)
        else:
            chapter['choices'].append(dict(id=heading[0], label=clean(heading[2:]), lines=paragraphs(body)))
    assert [c['id'] for c in chapter['choices']] == ['A', 'B', 'C']
    chapters.append(chapter)
Path('lib/story-v4.json').write_text(json.dumps(chapters, ensure_ascii=False, indent=2)+'\n')

# Scene and speaker maps use the source's chapter IDs, never array positions.
base = {'01':'office','02':'office','03':'classroom','04':'classroom','06':'classroom','08':'home','09':'classroom'}
C,X,W,Z,S,Y,T,N = '陈应','徐进','吴国平','张龙','笑笑','你','学生','旁白'
speakers = {
 '01':{'intro':{2:C,3:Y,5:C},'A':{0:Y,1:C,3:C,5:C},'B':{1:C,5:C,6:Y,7:C},'C':{0:Y,1:W,2:C,5:C},'common':{1:X,4:C}},
 '02':{'intro':{1:T,5:T,6:Y},'A':{0:Y,3:T,7:Y},'B':{1:Y,6:Y,11:T},'C':{0:Y,2:T,6:T},'common':{}},
 '03':{'intro':{3:T,6:T},'A':{0:Y,3:Y},'B':{1:Y,3:Y},'C':{0:Y,1:T,3:T,5:T,6:Y,7:T},'common':{2:Y,4:C,6:C}},
 '04':{'intro':{1:S},'A':{2:Y},'B':{1:Y,2:S,4:Y},'C':{1:Y,5:Y},'common':{3:W,4:Y,5:W}},
 '06':{'intro':{1:'家长',3:'家长',4:Y,5:'家长',8:'家长',12:Z},'A':{3:W},'C':{0:Y,2:T,3:Y},'common':{2:X}},
 '08':{'intro':{3:'孩子',8:Y,9:W},'A':{3:Z,5:Y},'B':{1:Y},'C':{0:Y,1:'孩子',3:Y,4:'孩子',7:W,8:Y}},
 '09':{'intro':{3:Y,7:T},'A':{0:Y,3:T},'C':{0:Y,1:T,3:Y,4:T,5:Y}},
}
scene_starts = {
 ('01','B'):'classroom',('01','common'):'corridor',
 ('03','common'):'office',('04','common'):'office',
 ('06','common'):'garden',('08','A'):'office',('08','B'):'office',('08','C'):'office',('08','common'):'office',
}
direction = {}
for chapter in chapters:
    chapter_id = chapter['id']
    direction[chapter_id] = {}
    for segment, lines in [('intro',chapter['intro']),*[(c['id'],c['lines']) for c in chapter['choices']],('common',chapter['common'])]:
        scene = scene_starts.get((chapter_id,segment),base[chapter_id])
        rows = []
        for i,line in enumerate(lines):
            if chapter_id=='01' and '离校时' in line:scene='garden'
            if chapter_id=='04' and '办公桌' in line:scene='office'
            if chapter_id=='04' and '走廊遇见吴国平' in line:scene='corridor'
            if chapter_id=='04' and '几周后' in line:scene='classroom'
            if chapter_id=='06' and ('办公室' in line or '她走后' in line):scene='office'
            if chapter_id=='06' and segment=='C':scene='classroom'
            if chapter_id=='08' and '等你赶到' in line:scene='office'
            speaker = speakers.get(chapter_id,{}).get(segment,{}).get(i,N)
            rows.append(dict(textStart=line[:18],scene=scene,cast=[] if speaker==N else [speaker],speaker=speaker))
        for i in speakers.get(chapter_id,{}).get(segment,{}):assert i<len(lines),(chapter_id,segment,i)
        direction[chapter_id][segment]=rows
Path('lib/story-v4-direction.json').write_text(json.dumps(direction,ensure_ascii=False,indent=2)+'\n')
Path('lib/story-source.json').write_text(json.dumps({'revision':'2026-09-10-1df0b558','source':source.name,'chapterIds':[c['id'] for c in chapters]},ensure_ascii=False,indent=2)+'\n')
print(f'Imported {len(chapters)} chapters, {sum(len(c["choices"]) for c in chapters)} branches; original chapter IDs retained.')
