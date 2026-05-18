import { motion } from 'framer-motion'

export default function ScoreBar({ label, value = 0, color = 'var(--text-primary)' }) {
  const pct = Math.round(value * 100)

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: '12px', fontFamily: 'Geist Mono', color: 'var(--text-primary)', fontWeight: 500 }}>{pct}%</span>
      </div>
      <div style={{ height: '4px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          style={{ height: '100%', background: color, borderRadius: '99px' }}
        />
      </div>
    </div>
  )
}