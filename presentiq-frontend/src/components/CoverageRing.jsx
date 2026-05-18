import { motion } from 'framer-motion'

export default function CoverageRing({ percent = 0, expected = 0 }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const filled = (percent / 100) * circ
  const expectedFilled = (expected / 100) * circ

  return (
    <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
      <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="70" cy="70" r={r} fill="none"
          stroke="var(--border)" strokeWidth="8"
          strokeDasharray={`${expectedFilled} ${circ - expectedFilled}`}
          opacity="0.4"
        />
        <motion.circle
          cx="70" cy="70" r={r} fill="none"
          stroke="var(--text-primary)" strokeWidth="8"
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${filled} ${circ - filled}` }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'Geist Mono', lineHeight: 1 }}>{Math.round(percent)}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '2px' }}>covered</span>
      </div>
    </div>
  )
}