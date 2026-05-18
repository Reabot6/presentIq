import { useEffect, useRef, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowCounterClockwise, CheckCircle, XCircle, Lightning,
  TrendUp, ChatCircle, Warning, Eye, Person, HandWaving,
} from '@phosphor-icons/react'

// ─── Confetti (fires once on mount) ─────────────────────────────────────────
function Confetti() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx    = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height= window.innerHeight
    const colors = ['#111111','#d4af37','#c0c0c0','#4ade80','#60a5fa','#f87171','#a78bfa','#ffffff']
    const pieces = Array.from({ length:140 }, () => ({
      x:  Math.random() * canvas.width,
      y: -20 - Math.random() * 180,
      w:  5 + Math.random() * 8,
      h:  3 + Math.random() * 4,
      rot:Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.16,
      vx: (Math.random() - 0.5) * 2.5,
      vy: 3 + Math.random() * 3.5,
      col:colors[Math.floor(Math.random() * colors.length)],
      op: 1,
    }))
    let raf
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = false
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.rv
        if (p.y > canvas.height * 0.55) p.op -= 0.02
        if (p.op > 0) {
          alive = true
          ctx.save(); ctx.globalAlpha = Math.max(0, p.op)
          ctx.translate(p.x + p.w/2, p.y + p.h/2); ctx.rotate(p.rot)
          ctx.fillStyle = p.col; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h)
          ctx.restore()
        }
      })
      if (alive) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={canvasRef} style={{ position:'fixed', inset:0, zIndex:9999, pointerEvents:'none' }} />
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const r    = 60
  const circ = 2 * Math.PI * r
  const col  = score >= 80 ? '#4ade80' : score >= 60 ? '#60a5fa' : score >= 40 ? '#facc15' : '#f87171'
  const label= score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs work'
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}>
      <div style={{ position:'relative', width:148, height:148 }}>
        <svg width="148" height="148" style={{ transform:'rotate(-90deg)' }}>
          <circle cx="74" cy="74" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <motion.circle cx="74" cy="74" r={r} fill="none" stroke={col} strokeWidth="8" strokeLinecap="round"
            initial={{ strokeDasharray:`0 ${circ}` }}
            animate={{ strokeDasharray:`${(score/100)*circ} ${circ}` }}
            transition={{ duration:1.4, ease:'easeOut', delay:0.4 }} />
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <motion.span initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.6 }}
            style={{ fontSize:'40px', fontWeight:800, color:'#fff', lineHeight:1, letterSpacing:'-0.04em', fontFamily:"'Geist Mono',monospace" }}>
            {Math.round(score)}
          </motion.span>
          <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', fontWeight:500 }}>/100</span>
        </div>
      </div>
      <span style={{ fontSize:'12px', padding:'4px 14px', background: col + '20', color: col, borderRadius:'99px', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase' }}>{label}</span>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, col = '#fff', delay = 0 }) {
  return (
    <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay, type:'spring', stiffness:90, damping:20 }}
      style={{ padding:'22px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px' }}>
      <p style={{ fontSize:'28px', fontWeight:800, color: col, fontFamily:"'Geist Mono',monospace", letterSpacing:'-0.03em', lineHeight:1, marginBottom:'5px' }}>{value}</p>
      <p style={{ fontSize:'11px', fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'rgba(255,255,255,0.35)', marginBottom: sub ? '3px' : 0 }}>{label}</p>
      {sub && <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.22)', lineHeight:1.4 }}>{sub}</p>}
    </motion.div>
  )
}

// ─── Coverage bar ─────────────────────────────────────────────────────────────
function CoverageBar({ label, icon, value = 0, delay = 0 }) {
  const pct = Math.round(value * 100)
  const col  = pct >= 70 ? '#4ade80' : pct >= 40 ? '#facc15' : '#f87171'
  return (
    <motion.div initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay }}
      style={{ marginBottom:'13px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <span style={{ color:'rgba(255,255,255,0.3)', lineHeight:0 }}>{icon}</span>
          <span style={{ fontSize:'11px', letterSpacing:'0.06em', textTransform:'uppercase', color:'rgba(255,255,255,0.45)', fontWeight:600 }}>{label}</span>
        </div>
        <span style={{ fontSize:'12px', fontFamily:"'Geist Mono',monospace", color: col, fontWeight:700 }}>{pct}%</span>
      </div>
      <div style={{ height:'3px', background:'rgba(255,255,255,0.07)', borderRadius:'99px', overflow:'hidden' }}>
        <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ duration:1, delay: delay + 0.2, ease:'easeOut' }}
          style={{ height:'100%', background: col, borderRadius:'99px' }} />
      </div>
    </motion.div>
  )
}

// ─── Feedback timeline ────────────────────────────────────────────────────────
const triggerMeta = {
  filler_spike: { label:'Filler spike', col:'#f87171' },
  keyword:      { label:'Keyword hit',  col:'#4ade80' },
  words:        { label:'Check-in',     col:'#60a5fa' },
  posture:      { label:'Posture',      col:'#facc15' },
  pace:         { label:'Pace',         col:'#a78bfa' },
  structure:    { label:'Structure',    col:'#fb923c' },
}

function FeedbackTimeline({ history }) {
  if (!history?.length) return (
    <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>No coaching events recorded.</p>
  )
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
      {history.map((f, i) => {
        const meta = triggerMeta[f.trigger] || triggerMeta.words
        return (
          <motion.div key={i} initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.06 }}
            style={{ display:'flex', gap:'14px', paddingBottom:'16px', position:'relative' }}>
            {/* Timeline line */}
            {i < history.length - 1 && (
              <div style={{ position:'absolute', left:'7px', top:'18px', bottom:0, width:'1px', background:'rgba(255,255,255,0.07)' }} />
            )}
            <div style={{ width:'15px', height:'15px', borderRadius:'50%', background: meta.col + '22', border:`1.5px solid ${meta.col}60`, flexShrink:0, marginTop:'2px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:'5px', height:'5px', borderRadius:'50%', background: meta.col }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'4px' }}>
                <span style={{ fontSize:'10px', fontWeight:700, color: meta.col, letterSpacing:'0.06em', textTransform:'uppercase' }}>{meta.label}</span>
                {f.severity && <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.2)', fontWeight:500 }}>{f.severity}</span>}
              </div>
              <p style={{ fontSize:'13px', fontWeight:600, color:'rgba(255,255,255,0.8)', lineHeight:1.5, marginBottom:'3px' }}>{f.top_issue}</p>
              {f.quick_tip && <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', lineHeight:1.5 }}>{f.quick_tip}</p>}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Quiz vs session comparison ───────────────────────────────────────────────
function QuizComparison({ weakAreas, coverage }) {
  if (!weakAreas?.length) return null
  const coveredKeywords = new Set(coverage?.keywords_hit || [])
  const improved = weakAreas.filter(w =>
    [...coveredKeywords].some(k => k.toLowerCase().includes(w.toLowerCase().slice(0,6)))
  )
  const missed   = weakAreas.filter(w => !improved.includes(w))

  return (
    <div>
      <p style={{ fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.25)', marginBottom:'14px', fontWeight:700 }}>Quiz weak areas → did you cover them?</p>
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {weakAreas.map((w, i) => {
          const covered = improved.includes(w)
          return (
            <motion.div key={i} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.07 }}
              style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', borderRadius:'9px', background: covered ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border:`1px solid ${covered ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.15)'}` }}>
              {covered
                ? <CheckCircle size={14} color="#4ade80" weight="fill" />
                : <XCircle    size={14} color="#f87171" weight="fill" />}
              <span style={{ fontSize:'13px', color: covered ? '#4ade80' : 'rgba(248,113,113,0.8)', fontWeight:600 }}>{w}</span>
              <span style={{ marginLeft:'auto', fontSize:'11px', color:'rgba(255,255,255,0.3)' }}>
                {covered ? 'Covered ✓' : 'Missed'}
              </span>
            </motion.div>
          )
        })}
      </div>
      {improved.length > 0 && missed.length === 0 && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }}
          style={{ marginTop:'12px', padding:'12px 16px', background:'rgba(74,222,128,0.1)', borderRadius:'10px', border:'1px solid rgba(74,222,128,0.2)' }}>
          <p style={{ fontSize:'13px', color:'#4ade80', fontWeight:600 }}>🎯 You covered every weak area from the quiz. That's a complete session.</p>
        </motion.div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Results() {
  const { sessionId }   = useParams()
  const { state }       = useLocation()
  const navigate        = useNavigate()
  const [tab, setTab]   = useState('overview')

  const cvScores       = state?.cvScores        || {}
  const feedbackHistory= state?.feedbackHistory  || []
  const coverage       = state?.coverage         || {}
  const lastFeedback   = state?.lastFeedback      || null
  const transcript     = state?.transcript        || ''
  const duration       = state?.duration          || 300
  const fillerCount    = state?.fillerCount       || 0
  const wpm            = state?.wpm               || 0
  const weakAreas      = state?.weakAreas         || []
  const topicMap       = state?.topicMap          || {}

  // Compute overall score
  const delivery  = ((cvScores.eye_contact||0)*0.35 + (cvScores.posture||0)*0.35 + (cvScores.gesture||0)*0.3)
  const speech    = Math.max(0, 1 - fillerCount * 0.04) * 0.5 + (wpm > 100 && wpm < 175 ? 0.5 : 0.2)
  const presence  = (delivery + speech) / 2
  const coveragePct = (coverage.coverage_percent || 0) / 100
  const rawScore  = (delivery * 0.35 + speech * 0.25 + presence * 0.2 + coveragePct * 0.2) * 100
  const overallScore = lastFeedback?.overall_score ?? Math.round(Math.max(0, Math.min(100, rawScore)))

  const TABS = [
    { id:'overview',  label:'Overview'   },
    { id:'coaching',  label:'Coaching timeline' },
    { id:'quiz',      label:'Quiz vs session' },
    { id:'transcript',label:'Transcript' },
  ]

  return (
    <div style={{ minHeight:'100dvh', background:'#0a0a0a', fontFamily:"'DM Sans',system-ui,sans-serif", color:'#fff' }}>
      <Confetti />

      {/* Nav */}
      <div style={{ position:'sticky', top:0, zIndex:100, background:'rgba(10,10,10,0.85)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'0 40px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'52px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <span style={{ fontSize:'12px', letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(255,255,255,0.25)', fontWeight:700 }}>PresentIQ</span>
          <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.2)' }}>Session #{sessionId}</span>
        </div>
        <motion.button whileTap={{ scale:0.96 }} onClick={() => navigate('/')}
          style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 16px', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'8px', background:'transparent', color:'rgba(255,255,255,0.7)', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
          <ArrowCounterClockwise size={13} /> Practice again
        </motion.button>
      </div>

      <div style={{ maxWidth:'980px', margin:'0 auto', padding:'48px 32px' }}>

        {/* Hero */}
        <motion.div initial={{ opacity:0, y:-14 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }}
          style={{ marginBottom:'44px' }}>
          <h1 style={{ fontSize:'42px', fontWeight:800, letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:'8px' }}>Session complete.</h1>
          <p style={{ fontSize:'14px', color:'rgba(255,255,255,0.35)' }}>
            {feedbackHistory.length} coaching events · {Math.round(duration/60)} min session · {Math.round(duration/60 * (wpm||0))} words estimated
          </p>
        </motion.div>

        {/* Score + quick stats */}
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'32px', marginBottom:'40px', alignItems:'start' }}>
          <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.2 }}>
            <ScoreRing score={overallScore} />
          </motion.div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
            <StatCard label="Words / min" value={wpm || '--'} col={wpm > 170 ? '#f87171' : wpm < 100 && wpm > 0 ? '#facc15' : '#4ade80'} delay={0.25}
              sub={wpm > 170 ? 'Too fast — slow down' : wpm < 100 && wpm > 0 ? 'Too slow — speed up' : wpm ? 'Ideal pace' : 'No speech detected'} />
            <StatCard label="Filler words" value={fillerCount} col={fillerCount > 15 ? '#f87171' : fillerCount > 8 ? '#facc15' : '#4ade80'} delay={0.3}
              sub={fillerCount > 15 ? 'High — needs work' : fillerCount > 8 ? 'Moderate' : 'Clean delivery'} />
            <StatCard label="Topics covered" value={`${coverage.coverage_percent?.toFixed(0) || 0}%`} col="#60a5fa" delay={0.35}
              sub={`${coverage.keywords_hit?.length || 0} of ${(coverage.keywords_hit?.length||0) + (coverage.uncovered_count||0)} topics`} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'2px', marginBottom:'28px', background:'rgba(255,255,255,0.04)', borderRadius:'10px', padding:'4px' }}>
          {TABS.map(t => (
            <motion.button key={t.id} whileTap={{ scale:0.97 }} onClick={() => setTab(t.id)}
              style={{ flex:1, padding:'8px 14px', borderRadius:'7px', background: tab===t.id ? 'rgba(255,255,255,0.1)' : 'transparent', border:'none', color: tab===t.id ? '#fff' : 'rgba(255,255,255,0.35)', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', letterSpacing:'0.02em' }}>
              {t.label}
              {t.id==='coaching' && feedbackHistory.length > 0 && (
                <span style={{ marginLeft:'5px', fontSize:'10px', background:'rgba(96,165,250,0.25)', color:'#60a5fa', padding:'1px 6px', borderRadius:'99px' }}>{feedbackHistory.length}</span>
              )}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <motion.div key="overview" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>

              {/* Charisma breakdown */}
              <div style={{ padding:'24px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px' }}>
                <p style={{ fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.25)', marginBottom:'18px', fontWeight:700 }}>Charisma breakdown</p>
                <CoverageBar label="Eye contact" icon={<Eye size={11} />}      value={cvScores.eye_contact || 0} delay={0.1} />
                <CoverageBar label="Posture"     icon={<Person size={11} />}   value={cvScores.posture     || 0} delay={0.15} />
                <CoverageBar label="Gesture"     icon={<HandWaving size={11} />} value={cvScores.gesture   || 0} delay={0.2} />
              </div>

              {/* Last feedback card */}
              <div style={{ padding:'24px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px' }}>
                <p style={{ fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.25)', marginBottom:'18px', fontWeight:700 }}>Final coach note</p>
                {lastFeedback ? (
                  <div>
                    <p style={{ fontSize:'15px', fontWeight:700, color:'#fff', lineHeight:1.5, marginBottom:'10px' }}>{lastFeedback.top_issue}</p>
                    <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.5)', lineHeight:1.6, marginBottom:'14px' }}>{lastFeedback.quick_tip}</p>
                    {lastFeedback.strengths?.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                        {lastFeedback.strengths.map((s, i) => (
                          <span key={i} style={{ fontSize:'11px', padding:'3px 10px', background:'rgba(74,222,128,0.12)', color:'#4ade80', borderRadius:'99px', fontWeight:600 }}>{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>Session was too short for feedback.</p>
                )}
              </div>

              {/* Topic coverage detail */}
              <div style={{ gridColumn:'1/-1', padding:'24px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px' }}>
                <p style={{ fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.25)', marginBottom:'16px', fontWeight:700 }}>Topic coverage</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                  {(coverage.keywords_hit || []).map((kw, i) => (
                    <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'5px 12px', background:'rgba(74,222,128,0.1)', color:'#4ade80', borderRadius:'99px', fontSize:'12px', fontWeight:600, border:'1px solid rgba(74,222,128,0.2)' }}>
                      <CheckCircle size={10} weight="fill" /> {kw}
                    </span>
                  ))}
                  {coverage.uncovered_count > 0 && Array.from({ length: coverage.uncovered_count }, (_, i) => (
                    <span key={`miss-${i}`} style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'5px 12px', background:'rgba(248,113,113,0.08)', color:'rgba(248,113,113,0.6)', borderRadius:'99px', fontSize:'12px', fontWeight:500, border:'1px solid rgba(248,113,113,0.15)' }}>
                      Missed topic
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* COACHING TIMELINE */}
          {tab === 'coaching' && (
            <motion.div key="coaching" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              style={{ padding:'28px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'24px' }}>
                <Lightning size={14} color="#facc15" weight="fill" />
                <p style={{ fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.25)', fontWeight:700 }}>
                  {feedbackHistory.length} coaching events fired
                </p>
              </div>
              <FeedbackTimeline history={feedbackHistory} />
            </motion.div>
          )}

          {/* QUIZ VS SESSION */}
          {tab === 'quiz' && (
            <motion.div key="quiz" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              style={{ padding:'28px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px' }}>
              <QuizComparison weakAreas={weakAreas} coverage={coverage} />
              {!weakAreas.length && (
                <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.25)', fontStyle:'italic' }}>No quiz taken — skip to practice next time or take the readiness quiz first.</p>
              )}
            </motion.div>
          )}

          {/* TRANSCRIPT */}
          {tab === 'transcript' && (
            <motion.div key="transcript" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              style={{ padding:'28px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px' }}>
              <p style={{ fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.25)', marginBottom:'16px', fontWeight:700 }}>Session transcript</p>
              {transcript.trim() ? (
                <p style={{ fontSize:'14px', color:'rgba(255,255,255,0.5)', lineHeight:1.9, maxHeight:'400px', overflowY:'auto', whiteSpace:'pre-wrap' }}>
                  {transcript.trim()}
                </p>
              ) : (
                <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.2)', fontStyle:'italic' }}>No transcript captured.</p>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}