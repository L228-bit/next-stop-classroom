'use client';
import { useId } from 'react';
import { mirrorFor, type Character, type Side } from '@/lib/v4-cast';

export default function CharacterSprite({person,side}:{person:Character;side:Side}) {
  const id=useId().replace(/:/g,'');
  const bounds: Record<string, [number, number]> = {
    'chen-ying.png':[5,1536], 'xu-jin-v2.png':[8,1528],
    'wu-guoping-v2.png':[8,1513], 'zhang-long.png':[20,1525],
    'xiaoxiao-v1.png':[5,1525], 'student-v2.png':[8,1505],
    'parent-v2.png':[11,1523], 'child-v2.png':[12,1523],
    'young-child-v2.png':[11,1509], 'narrator-v2.png':[7,1526],
    'player-v2.png':[1,1512], 'player-43.png':[1,1513], 'player-60.png':[3,1512],
  };
  const [top,bottom]=bounds[person.image.split('/').pop()!]??[0,1536];
  const height=bottom-top+16;
  const width=height*2/3;
  const viewBox=`${(1024-width)/2} ${top-8} ${width} ${height}`;
  return <figure className="vn-sprite vn-speaking" style={{'--sprite-direction':mirrorFor(person,side)?-1:1} as React.CSSProperties}>
    {<svg className="vn-character-image" viewBox={viewBox} role="img" aria-label={person.name} preserveAspectRatio="xMidYMin meet">
      <defs><filter id={`key-${id}`} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        {/* Composite the generated green-screen sprite over the live scene. */}
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  2 -4 2 2 0"/>
      </filter></defs>
      <image href={person.image} width="1024" height="1536" filter={person.chroma?`url(#key-${id})`:undefined}/>
    </svg>}
  </figure>;
}
