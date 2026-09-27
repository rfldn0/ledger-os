import type { CSSProperties } from 'react';

/** Spinning coin from assets/coin-spin.png (6 frames × 16px; row 0 gold, row 1 silver). */
export function coinStyle(size: 32 | 64, row = 0, extra: CSSProperties = {}): CSSProperties {
  const k = size / 16;
  return {
    width: size, height: size, flex: 'none',
    backgroundImage: 'url(assets/coin-spin.png)',
    backgroundSize: `${96 * k}px ${64 * k}px`,
    backgroundPositionY: -row * size + 'px',
    imageRendering: 'pixelated',
    animation: `lo-spin-${size} .6s steps(6) infinite`,
    ...extra
  };
}

export function Coin({ size, row = 0, still = false }: { size: 32 | 64; row?: number; still?: boolean }) {
  return <div aria-hidden style={coinStyle(size, row, still ? { animation: 'none' } : {})} />;
}

export function Icon({ src, size = 20 }: { src: string; size?: 16 | 18 | 20 | 24 | 26 | 28 | 32 }) {
  return <img className="px" src={src} alt="" width={size} height={size} />;
}

export function Blocks({ fill, color = '#2a2a28', empty = 'transparent' }: { fill: number; color?: string; empty?: string }) {
  return (
    <div className="blocks" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => <span key={i} style={{ background: i < fill ? color : empty }} />)}
    </div>
  );
}
