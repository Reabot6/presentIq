import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Stop, Lightning, CheckCircle, Circle,
  SpeakerHigh, Eye, Person, HandWaving, Timer, Waveform,
} from '@phosphor-icons/react'
import { createWebSocket } from '../api/client'

// ─── Confetti ────────────────────────────────────────────────────────────────
function Confetti({ active }) {
  const canvasRef = useRef(null)
  const animRef   = useRef(null)
  const pieces    = useRef([])

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ['#111111','#ffffff','#d4af37','#c0c0c0','#4ade80','#60a5fa','#f87171','#a78bfa']
    pieces.current = Array.from({ length: 160 }, () => ({
      x:   Math.random() * canvas.width,
      y:   -20 - Math.random() * 200,
      w:   6 + Math.random() * 8,
      h:   3 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      rv:  (Math.random() - 0.5) * 0.18,
      vx:  (Math.random() - 0.5) * 3,
      vy:  3 + Math.random() * 4,
      col: colors[Math.floor(Math.random() * colors.length)],
      op:  1,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = false
      pieces.current.forEach(p => {
        p.x  += p.vx; p.y += p.vy; p.rot += p.rv
        if (p.y > canvas.height * 0.6) p.op -= 0.018
        if (p.op > 0) {
          alive = true
          ctx.save()
          ctx.globalAlpha = Math.max(0, p.op)
          ctx.translate(p.x + p.w / 2, p.y + p.h / 2)
          ctx.rotate(p.rot)
          ctx.fillStyle = p.col
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
          ctx.restore()
        }
      })
      if (alive) animRef.current = requestAnimationFrame(draw)
    }
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [active])

  if (!active) return null
  return (
    <canvas ref={canvasRef}
      style={{ position:'fixed', inset:0, zIndex:9999, pointerEvents:'none' }} />
  )
}

// ─── Score bar ────────────────────────────────────────────────────────────────
function LiveBar({ label, value = 0, icon, highlight }) {
  const pct = Math.round(value * 100)
  const col  = pct >= 70 ? '#4ade80' : pct >= 40 ? '#facc15' : '#f87171'
  return (
    <motion.div animate={{ opacity: highlight ? 1 : 0.85 }}
      style={{ marginBottom:'14px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <span style={{ color:'var(--text-hint)', lineHeight:0 }}>{icon}</span>
          <span style={{ fontSize:'11px', letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--text-secondary)', fontWeight:600 }}>{label}</span>
        </div>
        <span style={{ fontSize:'12px', fontFamily:"'Geist Mono',monospace", color: col, fontWeight:700 }}>{pct}%</span>
      </div>
      <div style={{ height:'3px', background:'rgba(255,255,255,0.08)', borderRadius:'99px', overflow:'hidden' }}>
        <motion.div
          animate={{ width:`${pct}%`, backgroundColor: col }}
          transition={{ type:'spring', stiffness:60, damping:18 }}
          style={{ height:'100%', borderRadius:'99px' }} />
      </div>
    </motion.div>
  )
}

// ─── Feedback pill ───────────────────────────────────────────────────────────
const triggerMeta = {
  filler_spike: { label:'Filler spike', col:'#f87171', bg:'rgba(248,113,113,0.12)' },
  keyword:      { label:'Keyword hit',  col:'#4ade80', bg:'rgba(74,222,128,0.12)'  },
  words:        { label:'Check-in',     col:'#60a5fa', bg:'rgba(96,165,250,0.12)'  },
  posture:      { label:'Posture',      col:'#facc15', bg:'rgba(250,204,21,0.12)'  },
  pace:         { label:'Pace',         col:'#a78bfa', bg:'rgba(167,139,250,0.12)' },
  structure:    { label:'Structure',    col:'#fb923c', bg:'rgba(251,146,60,0.12)'  },
}

function FeedbackCard({ feedback, feedbackHistory }) {
  if (!feedback) return (
    <div style={{ padding:'20px', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', background:'rgba(255,255,255,0.03)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
        <Lightning size={13} color="#facc15" weight="fill" />
        <span style={{ fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.3)', fontWeight:600 }}>Live coaching</span>
      </div>
      <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.3)', lineHeight:1.6 }}>Coaching fires when you speak — say something!</p>
    </div>
  )

  const meta    = triggerMeta[feedback.trigger] || triggerMeta.words
  const sevCol  = feedback.severity === 'high' ? '#f87171' : feedback.severity === 'medium' ? '#facc15' : '#4ade80'

  return (
    <div>
      <AnimatePresence mode="wait">
        <motion.div key={feedback.top_issue}
          initial={{ opacity:0, y:10, scale:0.98 }}
          animate={{ opacity:1, y:0, scale:1 }}
          exit={{ opacity:0, y:-6 }}
          transition={{ type:'spring', stiffness:200, damping:22 }}
          style={{ padding:'18px', border:`1px solid ${meta.col}30`, borderRadius:'12px', background: meta.bg, marginBottom:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <Lightning size={12} color={meta.col} weight="fill" />
              <span style={{ fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', color: meta.col, fontWeight:700 }}>{meta.label}</span>
            </div>
            <div style={{ width:'6px', height:'6px', borderRadius:'50%', background: sevCol }} />
          </div>
          <p style={{ fontSize:'14px', fontWeight:600, color:'#fff', lineHeight:1.5, marginBottom:'8px' }}>{feedback.top_issue}</p>
          <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.6)', lineHeight:1.6 }}>{feedback.quick_tip}</p>
          {feedback.time_advice && (
            <div style={{ marginTop:'10px', padding:'8px 11px', background:'rgba(255,255,255,0.06)', borderRadius:'7px' }}>
              <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.45)', lineHeight:1.5 }}>{feedback.time_advice}</p>
            </div>
          )}
          {feedback.strengths?.length > 0 && (
            <div style={{ marginTop:'10px', display:'flex', flexWrap:'wrap', gap:'5px' }}>
              {feedback.strengths.map((s, i) => (
                <span key={i} style={{ fontSize:'10px', padding:'2px 9px', background:'rgba(74,222,128,0.15)', color:'#4ade80', borderRadius:'99px', fontWeight:600 }}>{s}</span>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {feedbackHistory.length > 1 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
          <p style={{ fontSize:'10px', letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,0.2)', marginBottom:'4px', fontWeight:600 }}>Previous</p>
          {feedbackHistory.slice(-3, -1).reverse().map((f, i) => {
            const m = triggerMeta[f.trigger] || triggerMeta.words
            return (
              <div key={i} style={{ padding:'8px 11px', borderRadius:'8px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)', display:'flex', gap:'8px', alignItems:'flex-start' }}>
                <div style={{ width:'4px', height:'4px', borderRadius:'50%', background: m.col, marginTop:'5px', flexShrink:0 }} />
                <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)', lineHeight:1.5 }}>{f.top_issue}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Keyword pill ─────────────────────────────────────────────────────────────
function KeywordPill({ kw, hit }) {
  return (
    <motion.span
      animate={{ background: hit ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.05)', color: hit ? '#4ade80' : 'rgba(255,255,255,0.3)', borderColor: hit ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.08)' }}
      transition={{ duration:0.4 }}
      style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'3px 10px', border:'1px solid', borderRadius:'99px', fontSize:'11px', fontWeight: hit ? 600 : 400 }}>
      {hit ? <CheckCircle size={9} weight="fill" /> : <Circle size={9} />}
      {kw}
    </motion.span>
  )
}

// ─── WPM ring ────────────────────────────────────────────────────────────────
function WpmRing({ wpm }) {
  const ideal  = 145
  const max    = 200
  const pct    = Math.min(wpm / max, 1)
  const r      = 28
  const circ   = 2 * Math.PI * r
  const col    = wpm > 170 ? '#f87171' : wpm < 100 && wpm > 0 ? '#facc15' : '#4ade80'
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
      <div style={{ position:'relative', width:68, height:68 }}>
        <svg width="68" height="68" style={{ transform:'rotate(-90deg)' }}>
          <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
          <motion.circle cx="34" cy="34" r={r} fill="none" stroke={col} strokeWidth="4" strokeLinecap="round"
            animate={{ strokeDasharray:`${pct * circ} ${circ}`, stroke: col }}
            transition={{ type:'spring', stiffness:50, damping:18 }}
          />
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:'14px', fontWeight:700, fontFamily:"'Geist Mono',monospace", color: col, lineHeight:1 }}>{wpm || '--'}</span>
          <span style={{ fontSize:'8px', color:'rgba(255,255,255,0.3)', letterSpacing:'0.05em', textTransform:'uppercase' }}>wpm</span>
        </div>
      </div>
      <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.25)', letterSpacing:'0.04em' }}>
        {wpm > 170 ? 'Too fast' : wpm < 100 && wpm > 0 ? 'Too slow' : wpm === 0 ? 'Silent' : 'Good pace'}
      </span>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Practice() {
  const { sessionId }  = useParams()
  const { state }      = useLocation()
  const navigate       = useNavigate()

  const keywords     = state?.keywords    || []
  const duration     = state?.duration    || 300
  const topicMap     = state?.topicMap    || {}
  const weakAreas    = state?.weakAreas   || []

  // ── Refs ──────────────────────────────────────────────────────────────────
  const videoRef          = useRef(null)
  const canvasRef         = useRef(null)
  const wsRef             = useRef(null)
  const streamRef         = useRef(null)
  const frameTimerRef     = useRef(null)
  const countdownRef      = useRef(null)
  const elapsedTickRef    = useRef(null)
  const speechRef         = useRef(null)      // Web Speech API
  const mediaRecRef       = useRef(null)      // MediaRecorder for Whisper
  const audioChunksRef    = useRef([])
  const whisperTimerRef   = useRef(null)
  const liveTranscriptRef = useRef('')        // fast layer (Web Speech)
  const finalTranscriptRef= useRef('')        // accuracy layer (Whisper)
  const elapsedRef        = useRef(0)
  const wpmWindowRef      = useRef([])        // {word, ts} pairs for rolling WPM

  // ── State ─────────────────────────────────────────────────────────────────
  const [started,        setStarted]        = useState(false)
  const [timeLeft,       setTimeLeft]       = useState(duration)
  const [cvScores,       setCvScores]       = useState({ eye_contact:0, posture:0, gesture:0, overall:0 })
  const [hitKeywords,    setHitKeywords]    = useState(new Set())
  const [feedback,       setFeedback]       = useState(null)
  const [feedbackHistory,setFeedbackHistory]= useState([])
  const [wsConnected,    setWsConnected]    = useState(false)
  const [cameraError,    setCameraError]    = useState('')
  const [liveCaption,    setLiveCaption]    = useState('')
  const [wpm,            setWpm]            = useState(0)
  const [fillerCount,    setFillerCount]    = useState(0)
  const [showConfetti,   setShowConfetti]   = useState(false)
  const [sessionResults, setSessionResults] = useState(null)

  const FILLERS = new Set(['um','uh','like','basically','literally','actually','so','right','kind','sort'])

  // ── Format time ───────────────────────────────────────────────────────────
  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
  const urgent = timeLeft < 60

  // ── Camera ────────────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      return stream
    } catch {
      setCameraError('Camera or mic access denied.')
      return null
    }
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    const ws = createWebSocket(sessionId)
    wsRef.current = ws

    ws.onopen = () => {
      setWsConnected(true)
      ws.send(JSON.stringify({
        type:             'init_session',
        keywords,
        duration_seconds: duration,
        topic_map:        topicMap,
        weak_areas:       weakAreas,
      }))
    }

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'frame_result') {
        setCvScores(msg.charisma)
        if (msg.coverage?.keywords_hit) {
          setHitKeywords(new Set(msg.coverage.keywords_hit))
        }
        // Pull coverage data for results
        setSessionResults(prev => ({ ...prev, coverage: msg.coverage }))
      }
      if (msg.type === 'feedback_update') {
        const fb = { ...msg.feedback, trigger: msg.trigger }
        setFeedback(fb)
        setFeedbackHistory(prev => [...prev, fb])
        setSessionResults(prev => ({ ...prev, lastFeedback: fb }))
      }
    }

    ws.onclose  = () => setWsConnected(false)
    ws.onerror  = () => setWsConnected(false)
  }, [sessionId, keywords, duration, topicMap, weakAreas])

  // ── Frame capture ─────────────────────────────────────────────────────────
  const captureFrame = useCallback(() => {
    if (!canvasRef.current || !videoRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return
    const cv = canvasRef.current, ctx = cv.getContext('2d')
    cv.width = 320; cv.height = 240
    ctx.drawImage(videoRef.current, 0, 0, 320, 240)
    wsRef.current.send(JSON.stringify({
      type:         'frame',
      image:        cv.toDataURL('image/jpeg', 0.7).split(',')[1],
      timestamp_ms: Date.now(),
    }))
  }, [])

  // ── Rolling WPM calculator ────────────────────────────────────────────────
  const updateWpm = useCallback((newWords) => {
    const now = Date.now()
    newWords.forEach(w => wpmWindowRef.current.push({ w, ts: now }))
    // Keep last 60 seconds only
    wpmWindowRef.current = wpmWindowRef.current.filter(x => now - x.ts < 60000)
    const windowSec = Math.min(60, elapsedRef.current || 1)
    setWpm(Math.round((wpmWindowRef.current.length / windowSec) * 60))
  }, [])

  // ── Web Speech API (fast layer) ───────────────────────────────────────────
  const startSpeechAPI = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.continuous    = true
    recognition.interimResults= true
    recognition.lang          = 'en-US'
    speechRef.current         = recognition

    recognition.onresult = (e) => {
      let interim = '', final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t + ' '
        else interim += t
      }
      setLiveCaption(interim || final.slice(-80))

      if (final) {
        liveTranscriptRef.current += final
        const words = final.trim().toLowerCase().split(/\s+/)
        updateWpm(words)

        // Naive filler count on fast layer (contextual filter on Whisper layer)
        const newFillers = words.filter(w => FILLERS.has(w)).length
        if (newFillers) setFillerCount(p => p + newFillers)

        // Push transcript_chunk over WS for event detection
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type:'transcript_chunk', text: final }))
        }
      }
    }

    recognition.onend = () => {
      if (streamRef.current) recognition.start()  // restart on silence
    }
    recognition.start()
  }, [updateWpm])

  // ── Whisper accuracy layer (3-second chunks) ──────────────────────────────
  const startWhisperLayer = useCallback((stream) => {
    const audioOnly = new MediaStream(stream.getAudioTracks())
    let rec = new MediaRecorder(audioOnly, { mimeType:'audio/webm' })
    mediaRecRef.current = rec
    audioChunksRef.current = []

    // Track chunk start time so we can compute exact chunk_duration
    let chunkStartTime = Date.now()

    rec.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
    rec.onstop = async () => {
      if (!audioChunksRef.current.length) return
      const blob = new Blob(audioChunksRef.current, { type:'audio/webm' })
      audioChunksRef.current = []

      // chunk_duration = how long THIS blob actually was (not cumulative elapsed)
      const chunkDuration = Math.round((Date.now() - chunkStartTime) / 1000)
      chunkStartTime = Date.now()  // reset for next chunk

      // Send to backend Whisper via REST (accuracy layer)
      try {
        const fd = new FormData()
        fd.append('session_id',      sessionId)
        fd.append('elapsed_seconds', String(elapsedRef.current))   // cumulative — for time_advice
        fd.append('chunk_duration',  String(chunkDuration))        // this chunk only — for tick()
        fd.append('audio', blob, 'chunk.webm')
        const res  = await fetch('http://localhost:8000/api/analysis/audio', { method:'POST', body: fd })
        const data = await res.json()
        if (data.transcript?.trim()) {
          // Whisper transcript is the accuracy layer — append to final record
          finalTranscriptRef.current += ' ' + data.transcript

          // Recompute WPM on accurate Whisper transcript
          const words = data.transcript.trim().split(/\s+/)
          updateWpm(words)

          // Contextual filler detection — exclude "like" when used as verb/adjective
          const contextualFillers = countContextualFillers(data.transcript)
          setFillerCount(p => Math.max(p, contextualFillers + (p > 0 ? p - 2 : 0)))

          // Sync keyword hits from Whisper accuracy layer → light up pills
          if (data.keywords_hit?.length) {
            setHitKeywords(prev => new Set([...prev, ...data.keywords_hit]))
          }

          // Send corrected transcript to WS for backend event detection
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type:'transcript_chunk', text: data.transcript }))
          }
        }
      } catch (_) {}

      // Restart
      if (streamRef.current) {
        rec = new MediaRecorder(audioOnly, { mimeType:'audio/webm' })
        mediaRecRef.current = rec
        rec.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
        rec.onstop = mediaRecRef.current.onstop
        rec.start()
        whisperTimerRef.current = setTimeout(() => { if (rec.state === 'recording') rec.stop() }, 3000)
      }
    }

    rec.start()
    whisperTimerRef.current = setTimeout(() => { if (rec.state === 'recording') rec.stop() }, 3000)
  }, [sessionId, updateWpm])

  // ── Contextual filler filter ──────────────────────────────────────────────
  function countContextualFillers(text) {
    const words = text.toLowerCase().split(/\s+/)
    let count   = 0
    words.forEach((w, i) => {
      const clean = w.replace(/[^a-z]/g, '')
      if (['um','uh'].includes(clean)) { count++; return }
      // "like" — only count as filler if followed by pause filler or standalone
      if (clean === 'like') {
        const next = words[i + 1]?.replace(/[^a-z]/g, '')
        if (!next || ['i','um','uh','so','well','you'].includes(next)) count++
        return
      }
      if (['basically','literally','actually','right','so'].includes(clean)) {
        // "so" at sentence start is often filler
        if (clean === 'so' && i === 0) count++
        else if (clean !== 'so') count++
      }
    })
    return count
  }

  // ── Start session ─────────────────────────────────────────────────────────
  const handleStart = async () => {
    const stream = await startCamera()
    if (!stream) return
    setStarted(true)
    connectWS()

    // Frames every 500ms
    frameTimerRef.current = setInterval(captureFrame, 500)

    // Elapsed tick every second
    elapsedTickRef.current = setInterval(() => {
      elapsedRef.current++
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type:'elapsed_tick', elapsed: elapsedRef.current }))
      }
    }, 1000)

    // Countdown
    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current); handleStop(true); return 0 }
        return prev - 1
      })
    }, 1000)

    // Dual audio pipeline
    startSpeechAPI()
    startWhisperLayer(stream)
  }

  // ── End session ───────────────────────────────────────────────────────────
  const handleStop = useCallback((fromTimer = false) => {
    clearInterval(frameTimerRef.current)
    clearInterval(countdownRef.current)
    clearInterval(elapsedTickRef.current)
    clearTimeout(whisperTimerRef.current)
    if (speechRef.current)    { speechRef.current.onend = null; speechRef.current.stop() }
    if (mediaRecRef.current?.state === 'recording') mediaRecRef.current.stop()
    if (wsRef.current)        wsRef.current.close()
    if (streamRef.current)    streamRef.current.getTracks().forEach(t => t.stop())

    // Confetti + navigate after short delay
    setShowConfetti(true)
    setTimeout(() => {
      navigate(`/results/${sessionId}`, {
        state: {
          cvScores,
          feedbackHistory,
          coverage:    sessionResults?.coverage || {},
          lastFeedback:sessionResults?.lastFeedback || null,
          transcript:  finalTranscriptRef.current || liveTranscriptRef.current,
          duration,
          fillerCount,
          wpm,
          weakAreas,
          topicMap,
        }
      })
    }, 2200)
  }, [sessionId, cvScores, feedbackHistory, sessionResults, duration, fillerCount, wpm, weakAreas, topicMap, navigate])

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => {
    clearInterval(frameTimerRef.current)
    clearInterval(countdownRef.current)
    clearInterval(elapsedTickRef.current)
    clearTimeout(whisperTimerRef.current)
    if (speechRef.current)  { speechRef.current.onend = null; speechRef.current.stop() }
    if (streamRef.current)  streamRef.current.getTracks().forEach(t => t.stop())
    if (wsRef.current)      wsRef.current.close()
  }, [])

  const timeRatio = (duration - timeLeft) / duration

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100dvh', background:'#0a0a0a', display:'grid', gridTemplateColumns:'1fr 360px', fontFamily:"'DM Sans',system-ui,sans-serif" }}>
      <Confetti active={showConfetti} />

      {/* ── LEFT — camera ── */}
      <div style={{ display:'flex', flexDirection:'column', padding:'24px 24px 24px 28px' }}>

        {/* Header bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <span style={{ fontSize:'12px', letterSpacing:'0.14em', textTransform:'uppercase', color:'rgba(255,255,255,0.25)', fontWeight:600 }}>PresentIQ</span>
            {started && (
              <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ repeat:Infinity, duration:1.6 }}
                  style={{ width:'5px', height:'5px', borderRadius:'50%', background: wsConnected ? '#4ade80' : '#f87171' }} />
                <span style={{ fontSize:'10px', color: wsConnected ? '#4ade80' : '#f87171', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' }}>
                  {wsConnected ? 'Live' : 'Reconnecting'}
                </span>
              </div>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
            <WpmRing wpm={wpm} />
            <motion.div
              animate={{ color: urgent ? '#f87171' : 'rgba(255,255,255,0.9)' }}
              style={{ fontFamily:"'Geist Mono',monospace", fontSize:'28px', fontWeight:700, letterSpacing:'-0.04em', minWidth:'70px', textAlign:'right' }}>
              {fmt(timeLeft)}
            </motion.div>
          </div>
        </div>

        {/* Camera */}
        <div style={{ flex:1, borderRadius:'14px', overflow:'hidden', position:'relative', background:'#111', minHeight:'380px' }}>
          <video ref={videoRef} muted playsInline
            style={{ width:'100%', height:'100%', objectFit:'cover', display: started ? 'block' : 'none' }} />
          <canvas ref={canvasRef} style={{ display:'none' }} />

          {!started && !cameraError && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'14px' }}>
              <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Camera size={28} color="rgba(255,255,255,0.25)" />
              </div>
              <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.2)', letterSpacing:'0.02em' }}>Ready when you are</p>
            </div>
          )}

          {cameraError && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px' }}>
              <p style={{ color:'#f87171', fontSize:'13px', textAlign:'center' }}>{cameraError}</p>
            </div>
          )}

          {/* Live caption */}
          <AnimatePresence>
            {liveCaption && started && (
              <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                style={{ position:'absolute', bottom:'48px', left:'16px', right:'16px', textAlign:'center' }}>
                <span style={{ display:'inline-block', background:'rgba(0,0,0,0.75)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', color:'rgba(255,255,255,0.9)', fontSize:'14px', lineHeight:1.5, padding:'6px 14px', borderRadius:'8px', maxWidth:'80%', fontWeight:500 }}>
                  {liveCaption}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress bar */}
          {started && (
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'3px', background:'rgba(255,255,255,0.07)' }}>
              <motion.div animate={{ width:`${timeRatio * 100}%` }} transition={{ duration:1 }}
                style={{ height:'100%', background: urgent ? '#f87171' : 'rgba(255,255,255,0.6)', borderRadius:'0 3px 3px 0' }} />
            </div>
          )}
        </div>

        {/* Stats row */}
        {started && (
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginTop:'14px' }}>
            {[
              { label:'Filler words', value: fillerCount, unit:'', col: fillerCount > 10 ? '#f87171' : fillerCount > 5 ? '#facc15' : '#4ade80' },
              { label:'Topics hit', value:`${hitKeywords.size}/${keywords.length}`, unit:'', col:'#60a5fa' },
              { label:'Elapsed', value: fmt(elapsedRef.current), unit:'', col:'rgba(255,255,255,0.45)' },
            ].map(s => (
              <div key={s.label} style={{ padding:'12px 14px', background:'rgba(255,255,255,0.04)', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.07)' }}>
                <p style={{ fontSize:'18px', fontWeight:700, color: s.col, fontFamily:"'Geist Mono',monospace", marginBottom:'3px' }}>{s.value}</p>
                <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)', letterSpacing:'0.06em', textTransform:'uppercase', fontWeight:600 }}>{s.label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Controls */}
        <div style={{ marginTop:'14px' }}>
          {!started ? (
            <motion.button whileTap={{ scale:0.98 }} onClick={handleStart}
              style={{ width:'100%', padding:'14px', background:'#fff', color:'#000', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', letterSpacing:'-0.01em' }}>
              <Camera size={16} weight="fill" /> Start session
            </motion.button>
          ) : (
            <motion.button whileTap={{ scale:0.98 }} onClick={() => handleStop(false)}
              style={{ width:'100%', padding:'14px', background:'rgba(248,113,113,0.12)', color:'#f87171', border:'1px solid rgba(248,113,113,0.3)', borderRadius:'10px', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
              <Stop size={16} weight="fill" /> End session
            </motion.button>
          )}
        </div>
      </div>

      {/* ── RIGHT — scores ── */}
      <div style={{ borderLeft:'1px solid rgba(255,255,255,0.07)', padding:'24px 24px 24px 20px', display:'flex', flexDirection:'column', gap:'20px', overflowY:'auto', background:'#0d0d0d' }}>

        {/* CV scores */}
        <div>
          <p style={{ fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.25)', marginBottom:'14px', fontWeight:700 }}>Charisma</p>
          <LiveBar label="Eye contact" value={cvScores.eye_contact} icon={<Eye size={11} />} />
          <LiveBar label="Posture"     value={cvScores.posture}     icon={<Person size={11} />} />
          <LiveBar label="Gesture"     value={cvScores.gesture}     icon={<HandWaving size={11} />} />
        </div>

        <div style={{ height:'1px', background:'rgba(255,255,255,0.07)' }} />

        {/* Keywords */}
        <div>
          <p style={{ fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.25)', marginBottom:'12px', fontWeight:700 }}>Topics coverage</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
            {keywords.map(kw => (
              <KeywordPill key={kw} kw={kw} hit={hitKeywords.has(kw.toLowerCase())} />
            ))}
            {!keywords.length && <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.2)' }}>No keywords set</p>}
          </div>
        </div>

        <div style={{ height:'1px', background:'rgba(255,255,255,0.07)' }} />

        {/* Feedback */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
            <p style={{ fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.25)', fontWeight:700 }}>Live coaching</p>
            {feedbackHistory.length > 0 && (
              <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.2)' }}>{feedbackHistory.length} fired</span>
            )}
          </div>
          <FeedbackCard feedback={feedback} feedbackHistory={feedbackHistory} />
        </div>

        {/* Weak areas reminder */}
        {weakAreas.length > 0 && (
          <>
            <div style={{ height:'1px', background:'rgba(255,255,255,0.07)' }} />
            <div>
              <p style={{ fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.25)', marginBottom:'10px', fontWeight:700 }}>Quiz weak areas — watch these</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
                {weakAreas.map((w, i) => (
                  <span key={i} style={{ fontSize:'10px', padding:'2px 9px', background:'rgba(248,113,113,0.1)', color:'rgba(248,113,113,0.7)', borderRadius:'99px', border:'1px solid rgba(248,113,113,0.2)', fontWeight:600 }}>{w}</span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}