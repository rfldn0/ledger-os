import type { ConfirmAnim } from '../lib/types';
import { coinStyle } from './Sprites';

/** Coin that hops (and optionally bursts) each time an entry is committed. */
export function CommitFeedback({ burstKey, silver, mode }: { burstKey: number; silver: boolean; mode: ConfirmAnim }) {
  const hit = burstKey > 0 && mode !== 'off';
  const row = silver ? 1 : 0;
  const ring = (c: string, delay: number) => (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', width: 64, height: 64, marginLeft: -32, marginTop: -32,
      boxShadow: `0 -4px 0 ${c},0 4px 0 ${c},-4px 0 0 ${c},4px 0 0 ${c}`,
      animation: `lo-ring .6s steps(6) ${delay}s both`, pointerEvents: 'none'
    }} />
  );
  return (
    <div aria-hidden style={{ position: 'relative', flex: '0 0 64px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {hit && mode === 'burst' && (
        <div key={'b' + burstKey} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {Array.from({ length: 9 }, (_, i) => {
            const a = -Math.PI / 2 + (i - 4) * 0.32, dist = 100 + (i % 3) * 28;
            return (
              <div key={i} style={{
                ...coinStyle(32, row),
                position: 'absolute', left: '50%', top: '50%', marginLeft: -16, marginTop: -16,
                ['--dx' as string]: Math.cos(a) * dist + 'px', ['--dy' as string]: Math.sin(a) * dist + 'px',
                animation: `lo-spin-32 .5s steps(6) infinite, lo-fly 1.1s cubic-bezier(.2,.7,.3,1) ${i * 35}ms both`
              }} />
            );
          })}
        </div>
      )}
      <div key={'c' + burstKey} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: hit ? 'lo-hop .8s steps(10) both' : 'none' }}>
        {hit && ring(silver ? '#8a8f9a' : '#e8955a', .3)}
        {hit && ring('#fbf8ee', .45)}
        <div style={coinStyle(64, row, mode === 'off' ? { animation: 'none' } : hit ? { animation: 'lo-spin-64 .1s steps(6) 7, lo-glow .8s steps(4), lo-spin-64 .6s steps(6) .7s infinite' } : {})} />
      </div>
    </div>
  );
}
