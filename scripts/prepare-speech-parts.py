"""Match explicit speaker annotations to existing game paragraphs without rewriting prose."""
import json
import pathlib
import re

SOURCE = pathlib.Path('/Users/linjiawei/.codex/attachments/1af6ba5e-2e30-49d7-b7ad-240c3e0298d9/pasted-text.txt')
MARKER = re.compile(r'（([^（）]+)）[：:]')

def normalize(text):
    return ''.join(c for c in text if c.isalnum())

def prepare():
    records = {}
    for line in SOURCE.read_text().splitlines():
        line = re.sub(r'\{#[^}]+\}', '', line.replace('\\', ''))
        matches = list(MARKER.finditer(line))
        if not matches:
            continue
        parts = []
        for i, match in enumerate(matches):
            text = line[match.end():matches[i+1].start() if i+1<len(matches) else len(line)].strip()
            speaker = '你' if match[1] == '我' else match[1]
            if text:
                if parts and parts[-1]['speaker'] == speaker:
                    parts[-1]['text'] += text
                else:
                    parts.append({'speaker': speaker, 'text': text})
        records[normalize(''.join(p['text'] for p in parts))] = parts
    result = {}
    for chapter in json.loads(pathlib.Path('lib/story-v4.json').read_text()):
        for segment, lines in [('intro',chapter['intro']), *[(c['id'],c['lines']) for c in chapter['choices']], ('common',chapter['common'])]:
            for index, text in enumerate(lines):
                key = f"{chapter['id']}/{segment}/{index:03d}"
                parts = records.get(normalize(text))
                if parts is None:
                    raise ValueError(f'No source annotation for {key}: {text}')
                result[key] = parts
    return result

if __name__ == '__main__':
    result = prepare()
    pathlib.Path('lib/speech-parts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(f'{len(result)} paragraphs, {sum(map(len,result.values()))} voice parts')
