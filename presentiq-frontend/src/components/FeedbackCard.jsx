import { motion, AnimatePresence } from 'framer-motion'
import { Lightning, ArrowUp, Clock } from '@phosphor-icons/react'

export default function FeedbackCard({ feedback, loading }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '24px',
      minHeight: '180px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Lightning size={14} weight="fill" color="var(--amber)" />
        <span style={{ fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          Live coaching
        </span>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {[100, 80, 60].map((w, i) => (
              <div key={i} style={{
                height: '12px', width: `${w}%`,
                background: 'var(--border)', borderRadius: '6px',
                marginBottom: '10px',
                animation: 'shimmer 1.5s infinite',
              }} />
            ))}
          </motion.div>
        ) : feedback ? (
          <motion.div key="content"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>

            <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px', lineHeight: 1.5 }}>
              {feedback.top_issue}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
              {feedback.quick_tip}
            </p>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px',
              padding: '10px 12px', background: 'var(--amber-bg)',
              borderRadius: 'var(--radius-sm)' }}>
              <Clock size={13} color="var(--amber)" style={{ marginTop: '2px', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: 'var(--amber)', lineHeight: 1.5 }}>
                {feedback.time_advice}
              </span>
            </div>

            {feedback.strengths?.length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {feedback.strengths.map((s, i) => (
                  <span key={i} style={{
                    fontSize: '11px', padding: '3px 10px',
                    background: 'var(--green-bg)', color: 'var(--green)',
                    borderRadius: '99px', letterSpacing: '0.02em'
                  }}>
                    {s}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.p key="empty"
            initial={{ opacity: 0 }} animate={{ opacity: 0.4 }}
            style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Feedback appears once your session starts...
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}