// Цветной аватар на основе хеша id — для быстрого визуального сканирования списков.
// 8 палитр в брендовой гамме (зелёные, синие, фиолет, янтарь и т.д.).

const PALETTES = [
  { bg: 'rgba(34,197,94,0.18)',   fg: '#86efac', border: 'rgba(34,197,94,0.30)'  }, // green
  { bg: 'rgba(96,165,250,0.18)',  fg: '#93c5fd', border: 'rgba(96,165,250,0.30)' }, // blue
  { bg: 'rgba(167,139,250,0.18)', fg: '#c4b5fd', border: 'rgba(167,139,250,0.30)'}, // purple
  { bg: 'rgba(251,146,60,0.18)',  fg: '#fdba74', border: 'rgba(251,146,60,0.30)' }, // orange
  { bg: 'rgba(244,114,182,0.18)', fg: '#f9a8d4', border: 'rgba(244,114,182,0.30)'}, // pink
  { bg: 'rgba(45,212,191,0.18)',  fg: '#5eead4', border: 'rgba(45,212,191,0.30)' }, // teal
  { bg: 'rgba(250,204,21,0.18)',  fg: '#fde047', border: 'rgba(250,204,21,0.30)' }, // yellow
  { bg: 'rgba(248,113,113,0.18)', fg: '#fca5a5', border: 'rgba(248,113,113,0.30)'}, // red-soft
] as const

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function avatarPalette(id: string) {
  return PALETTES[hash(id) % PALETTES.length]
}

export function Avatar({
  id, name, size = 36, className = '',
}: {
  id: string
  name: string
  size?: number
  className?: string
}) {
  const p = avatarPalette(id)
  return (
    <div
      className={`rounded-xl shrink-0 flex items-center justify-center font-bold ${className}`}
      style={{
        width: size, height: size,
        background: p.bg, color: p.fg,
        border: `1px solid ${p.border}`,
        fontSize: size * 0.4,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}
