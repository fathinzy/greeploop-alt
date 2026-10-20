// A lightweight SVG "barcode" rendered deterministically from a string.
// This is a visual demo barcode (not a scannable Code128), generated with no
// dependencies so it works offline. Bar widths derive from the code's chars.
export default function Barcode({ value, height = 56, className = '' }) {
  const str = String(value || '')
  // Build a reproducible pseudo-random bar pattern from the characters.
  const bars = []
  let x = 0
  const unit = 2
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    // 4 bars per character: alternating bar/space with widths 1..4.
    for (let b = 0; b < 4; b++) {
      const w = (((c >> b) & 0x3) + 1) * unit
      const isBar = ((c + b) & 1) === 0
      if (isBar) bars.push({ x, w })
      x += w
    }
  }
  const totalWidth = x || 1

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${height}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={`Barcode ${str}`}
    >
      <rect width={totalWidth} height={height} fill="#ffffff" />
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height={height} fill="#0f172a" />
      ))}
    </svg>
  )
}
