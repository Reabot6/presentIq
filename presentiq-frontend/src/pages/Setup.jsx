import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Timer, TextT, Tag, UploadSimple,
  FileText, CheckCircle, ArrowRight, ChatCircle,
  Brain, Warning, Prohibit, House,
} from '@phosphor-icons/react'
import { createSession, uploadDocument } from '../api/client'

const API_BASE  = 'http://localhost:8000'
const ACCEPTED  = '.pdf,.docx,.doc,.pptx,.ppt,.txt,.md'
const STORE_KEY = 'presentiq_session'

// ── sessionStorage helpers ────────────────────────────────────────────────────
const SS = {
  save:  (data) => { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(data)) } catch {} },
  load:  ()     => { try { const r = sessionStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : null } catch { return null } },
  clear: ()     => { try { sessionStorage.removeItem(STORE_KEY) } catch {} },
}

// ── Quiz API helpers ──────────────────────────────────────────────────────────
const quizAPI = {
  start: (session_id, topic_map) =>
    fetch(`${API_BASE}/api/quiz/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: parseInt(session_id), topic_map }),
    }).then(r => r.json()),

  message: (payload) =>
    fetch(`${API_BASE}/api/quiz/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, session_id: parseInt(payload.session_id) }),
    }).then(r => r.json()),

  finish: (session_id) =>
    fetch(`${API_BASE}/api/quiz/finish`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: parseInt(session_id) }),
    }).then(r => r.json()),
}

// ── Steps ─────────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'setup', label: 'Setup'           },
  { id: 'coach', label: 'Coach Brief'     },
  { id: 'quiz',  label: 'Readiness Quiz'  },
  { id: 'ready', label: 'Start Session'   },
]

// ── Quadrant animation ────────────────────────────────────────────────────────
const QV = {
  topLeft:     { hidden: { x: '-100%', y: '-100%', opacity: 0 }, visible: { x: 0, y: 0, opacity: 1 } },
  topRight:    { hidden: { x:  '100%', y: '-100%', opacity: 0 }, visible: { x: 0, y: 0, opacity: 1 } },
  bottomLeft:  { hidden: { x: '-100%', y:  '100%', opacity: 0 }, visible: { x: 0, y: 0, opacity: 1 } },
  bottomRight: { hidden: { x:  '100%', y:  '100%', opacity: 0 }, visible: { x: 0, y: 0, opacity: 1 } },
}
const QT = { type: 'spring', stiffness: 260, damping: 28 }

const DURATIONS = [
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
  { label: '15 min', value: 900 },
]

const rColor = (s) => s >= 80 ? '#22c55e' : s >= 60 ? '#f59e0b' : '#ef4444'

// ─────────────────────────────────────────────────────────────────────────────
export default function Setup() {
  const navigate      = useNavigate()
  const fileInputRef  = useRef(null)
  const chatBottomRef = useRef(null)

  // Form
  const [title,    setTitle]    = useState('')
  const [duration, setDuration] = useState(300)
  const [keywords, setKeywords] = useState([])
  const [kwInput,  setKwInput]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  // Doc
  const [docFile,      setDocFile]      = useState(null)
  const [docFileName,  setDocFileName]  = useState('')
  const [docUploading, setDocUploading] = useState(false)
  const [docError,     setDocError]     = useState('')
  const [topicMap,     setTopicMap]     = useState(null)
  const [coachOpen,    setCoachOpen]    = useState(false)
  const [coachMin,     setCoachMin]     = useState(false)
  const [activeTab,    setActiveTab]    = useState('brief')

  // Session
  const [sessionId, setSessionId] = useState(null)

  // Steps
  const [completedSteps, setCompletedSteps] = useState([])
  const [currentStep,    setCurrentStep]    = useState('setup')

  // Quiz
  const [quizOpen,        setQuizOpen]        = useState(false)
  const [quizStarted,     setQuizStarted]     = useState(false)
  const [quizLoading,     setQuizLoading]     = useState(false)
  const [quizDone,        setQuizDone]        = useState(false)
  const [quizBanned,      setQuizBanned]      = useState(false)
  const [offTopicWarned,  setOffTopicWarned]  = useState(false)
  const [readiness,       setReadiness]       = useState(null)
  const [curQuestion,     setCurQuestion]     = useState('')
  const [curTopic,        setCurTopic]        = useState('')
  const [questionsLeft,   setQuestionsLeft]   = useState(0)
  const [totalQ,          setTotalQ]          = useState(5)
  const [chatHistory,     setChatHistory]     = useState([])
  const [userInput,       setUserInput]       = useState('')

  // ── Restore from sessionStorage ───────────────────────────────────────────
  useEffect(() => {
    const s = SS.load()
    if (!s) return
    if (s.title)          setTitle(s.title)
    if (s.duration)       setDuration(s.duration)
    if (s.keywords)       setKeywords(s.keywords)
    if (s.topicMap)       { setTopicMap(s.topicMap); setCoachOpen(true) }
    if (s.docFileName)    setDocFileName(s.docFileName)
    if (s.sessionId)      setSessionId(s.sessionId)
    if (s.completedSteps) setCompletedSteps(s.completedSteps)
    if (s.currentStep)    setCurrentStep(s.currentStep)
    if (s.quizDone)       setQuizDone(s.quizDone)
    if (s.quizBanned)     setQuizBanned(s.quizBanned)
    if (s.readiness)      setReadiness(s.readiness)
    if (s.chatHistory)    setChatHistory(s.chatHistory)
    if (s.curQuestion)    setCurQuestion(s.curQuestion)
    if (s.curTopic)       setCurTopic(s.curTopic)
    if (s.offTopicWarned) setOffTopicWarned(s.offTopicWarned)
  }, [])

  // ── Persist to sessionStorage ─────────────────────────────────────────────
  useEffect(() => {
    SS.save({
      title, duration, keywords, topicMap, docFileName,
      sessionId, completedSteps, currentStep,
      quizDone, quizBanned, readiness,
      chatHistory, curQuestion, curTopic, offTopicWarned,
    })
  }, [title, duration, keywords, topicMap, docFileName, sessionId,
      completedSteps, currentStep, quizDone, quizBanned, readiness,
      chatHistory, curQuestion, curTopic, offTopicWarned])

  // ── Scroll chat ───────────────────────────────────────────────────────────
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatHistory, quizLoading])

  // ── Step helpers ──────────────────────────────────────────────────────────
  const completeStep  = (id) => setCompletedSteps(p => p.includes(id) ? p : [...p, id])
  const goToStep      = (id) => {
    if (!completedSteps.includes(id) && id !== currentStep) return
    setCurrentStep(id)
    if (id === 'coach') { setCoachOpen(true); setCoachMin(false) }
    if (id === 'quiz')  setQuizOpen(true)
    if (id === 'setup') { setCoachOpen(false); setQuizOpen(false) }
  }

  // ── Keyword helpers ───────────────────────────────────────────────────────
  const addKeyword  = () => { const kw = kwInput.trim(); if (kw && !keywords.includes(kw)) { setKeywords([...keywords, kw]); setKwInput('') } }
  const removeKw    = (kw) => setKeywords(keywords.filter(k => k !== kw))
  const onKwKey     = (e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }

  // ── File handling ─────────────────────────────────────────────────────────
  const onDrop   = (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) processFile(f) }
  const onSelect = (e) => { const f = e.target.files[0]; if (f) processFile(f) }

  const processFile = async (file) => {
    setDocFile(file); setDocFileName(file.name); setDocError('')
    setTopicMap(null); setCoachOpen(false); setDocUploading(true)
    try {
      const result = await uploadDocument(file, title || file.name)
      setTopicMap(result)
      if (result.keywords?.length > 0 && keywords.length === 0) setKeywords(result.keywords.slice(0, 8))
      if (!title && result.title) setTitle(result.title)
      setTimeout(() => { setCoachOpen(true); setCurrentStep('coach'); completeStep('setup') }, 200)
    } catch (e) {
      setDocError(e.response?.data?.detail || 'Upload failed. Check file format.')
      setDocFile(null); setDocFileName('')
    } finally { setDocUploading(false) }
  }

  const removeDoc = () => {
    setDocFile(null); setDocFileName(''); setTopicMap(null); setDocError('')
    setCoachOpen(false); setQuizOpen(false); setQuizStarted(false)
    setReadiness(null); setChatHistory([])
    setCompletedSteps([]); setCurrentStep('setup')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────
  const openQuiz = async () => {
    if (quizBanned) { setQuizOpen(true); return }  // show banned screen
    let sid = sessionId
    if (!sid) {
      if (!title.trim()) { setError('Add a title before taking the quiz'); return }
      if (!keywords.length) { setError('Add at least one keyword first'); return }
      setError('')
      try {
        const res = await createSession({ title, duration_seconds: duration, keywords })
        sid = res.data.id; setSessionId(sid); completeStep('setup')
      } catch { setError('Could not connect to backend'); return }
    }
    setQuizOpen(true); setCurrentStep('quiz')
  }

  const startQuiz = async () => {
    setQuizLoading(true); setQuizStarted(true)
    try {
      const d = await quizAPI.start(sessionId, topicMap)
      const intro = []
      if (d.coach_intro) intro.push({ role: 'coach', text: d.coach_intro })
      intro.push({ role: 'coach', text: d.question })
      setChatHistory(intro)
      setCurQuestion(d.question); setCurTopic(d.topic)
      setQuestionsLeft(d.questions_remaining); setTotalQ(d.total_questions)
    } catch { setChatHistory([{ role: 'coach', text: "Couldn't load quiz. Check backend." }])
    } finally { setQuizLoading(false) }
  }

  const submitAnswer = async () => {
    if (!userInput.trim() || quizLoading) return
    const answer = userInput.trim()
    setUserInput('')
    setChatHistory(p => [...p, { role: 'user', text: answer }])
    setQuizLoading(true)
    try {
      const d = await quizAPI.message({ session_id: sessionId, user_answer: answer, current_question: curQuestion, current_topic: curTopic })

      // Re-engagement
      if (d.is_repeat) {
        setChatHistory(p => [...p, { role: 'coach', text: d.feedback }, { role: 'coach', text: d.next_question }])
        setQuizLoading(false); return
      }

      // Off-topic
      if (d.off_topic) {
        if (d.banned) {
          setQuizBanned(true); setOffTopicWarned(false)
          setChatHistory(p => [...p, { role: 'warning', text: d.feedback, banned: true }])
        } else {
          setOffTopicWarned(true)
          setChatHistory(p => [...p, { role: 'warning', text: d.feedback, banned: false }])
        }
        setQuizLoading(false); return
      }

      // Normal
      setChatHistory(p => [...p, { role: 'coach', text: d.feedback, score: d.score }])
      if (d.is_final) {
        const result = await quizAPI.finish(sessionId)
        setReadiness(result); setQuizDone(true)
        completeStep('quiz'); setCurrentStep('ready')
        setChatHistory(p => [...p, { role: 'result', text: result.message, score: result.readiness_score, weakAreas: result.weak_areas }])
      } else {
        setChatHistory(p => [...p, { role: 'coach', text: d.next_question }])
        setCurQuestion(d.next_question); setCurTopic(d.next_topic)
        setQuestionsLeft(q => q - 1)
      }
    } catch { setChatHistory(p => [...p, { role: 'coach', text: 'Connection issue. Try again.' }])
    } finally { setQuizLoading(false) }
  }

  const onChatKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAnswer() } }

  const resetSession = () => {
    SS.clear()
    setTitle(''); setDuration(300); setKeywords([]); setKwInput('')
    setDocFile(null); setDocFileName(''); setTopicMap(null)
    setCoachOpen(false); setCoachMin(false); setSessionId(null)
    setCompletedSteps([]); setCurrentStep('setup')
    setQuizOpen(false); setQuizStarted(false); setQuizBanned(false)
    setOffTopicWarned(false); setReadiness(null); setChatHistory([])
    setCurQuestion(''); setCurTopic(''); setQuizDone(false); setError('')
  }

  // ── Start session ─────────────────────────────────────────────────────────
const handleStart = async () => {
  if (!title.trim()) { setError('Give your presentation a title'); return }
  if (!keywords.length) { setError('Add at least one keyword to track coverage'); return }
  setError(''); setLoading(true)
  try {
    let sid = sessionId
    if (!sid) {
      const res = await createSession({ title, duration_seconds: duration, keywords })
      sid = res.data.id
    }
    SS.clear()
    navigate(`/practice/${sid}`, {
      state: {
        keywords,
        duration,
        topicMap:  topicMap  || {},           // ← was missing
        weakAreas: readiness?.weak_areas || [], // ← was missing
      }
    })
  } catch {
    setError('Could not connect to backend. Is it running?')
  } finally {
    setLoading(false)
  }
}

  // ── Time breakdown ────────────────────────────────────────────────────────
  const timeBreakdown = (() => {
    const flow = topicMap?.expected_flow || []
    if (!flow.length) return []
    const mins = duration / 60; const per = mins / flow.length
    return flow.map((step, i) => ({
      label: step, start: `${Math.floor(i * per)}:00`, end: `${Math.floor((i+1)*per)}:00`,
      pct: Math.round(100/flow.length), isKey: i === Math.floor(flow.length / 2),
    }))
  })()
  const watchTopics = topicMap?.key_terms?.slice(0, 6) || keywords.slice(0, 6)
  const qAnswered   = totalQ - questionsLeft

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── STEP NAV ── */}
      <StepNav steps={STEPS} completedSteps={completedSteps} currentStep={currentStep} onNavigate={goToStep} onReset={resetSession} />

      {/* ── LEFT PANEL ── */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
        style={{ background: 'var(--text-primary)', color: 'var(--accent-fg)', padding: '80px 64px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.35 }}>PresentIQ</p>
        <div>
          <h1 style={{ fontSize: '44px', fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.03em', marginBottom: '18px' }}>
            Practice like<br />it's the real thing.
          </h1>
          <p style={{ fontSize: '14px', opacity: 0.45, lineHeight: 1.75, maxWidth: '320px' }}>
            Upload your slides or notes — PresentIQ reads your material and coaches you on exactly what you need to cover.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.08)', borderRadius: '14px', overflow: 'hidden' }}>
          {[['Eye contact','Iris tracking'],['Posture','Shoulder alignment'],['Speech pace','120–160 WPM ideal'],['Doc coverage','AI reads your notes']].map(([label, desc]) => (
            <div key={label} style={{ padding: '20px', background: 'rgba(255,255,255,0.03)' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{label}</p>
              <p style={{ fontSize: '11px', opacity: 0.35 }}>{desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── RIGHT PANEL ── */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        style={{ padding: '80px 56px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflowY: 'auto', maxHeight: '100dvh' }}>

        <h2 style={{ fontSize: '21px', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: '4px' }}>Set up your session</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '28px' }}>Upload your material and we'll coach you on everything.</p>

        {/* Doc upload */}
        <div style={{ marginBottom: '22px' }}>
          <label style={LS}><UploadSimple size={11} /> Presentation material <span style={{ fontSize: '10px', opacity: 0.45, textTransform: 'none', letterSpacing: 0 }}>— optional but recommended</span></label>
          <AnimatePresence mode="wait">
            {!docFileName ? (
              <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onDragOver={e => e.preventDefault()} onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                whileHover={{ borderColor: 'var(--text-primary)' }}
                style={{ border: '1.5px dashed var(--border)', borderRadius: '10px', padding: '22px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface)', transition: 'border-color 0.15s' }}>
                <UploadSimple size={18} color="var(--text-hint)" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '3px' }}>Drop your file here or click to browse</p>
                <p style={{ fontSize: '11px', color: 'var(--text-hint)' }}>PDF, DOCX, PPTX, TXT, MD — max 10MB</p>
                <input ref={fileInputRef} type="file" accept={ACCEPTED} onChange={onSelect} style={{ display: 'none' }} />
              </motion.div>
            ) : (
              <motion.div key="file" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={15} color="var(--text-secondary)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{docFileName}</p>
                  </div>
                  {docUploading ? <Spinner /> : topicMap ? <CheckCircle size={15} color="#22c55e" weight="fill" /> : null}
                  <motion.div whileTap={{ scale: 0.85 }} onClick={removeDoc} style={{ cursor: 'pointer', lineHeight: 0 }}><X size={13} color="var(--text-hint)" /></motion.div>
                </div>
                {topicMap && coachMin && (
                  <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileTap={{ scale: 0.96 }}
                    onClick={() => { setCoachMin(false); setCurrentStep('coach') }}
                    style={{ marginTop: '10px', width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '7px', background: 'transparent', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Brain size={12} weight="fill" /> View coach brief
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {docError && <p style={{ fontSize: '12px', color: 'var(--red)', marginTop: '6px' }}>{docError}</p>}
        </div>

        {/* Title */}
        <div style={{ marginBottom: '20px' }}>
          <label style={LS}><TextT size={11} /> Presentation title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Q3 investor pitch" style={IS} />
        </div>

        {/* Duration */}
        <div style={{ marginBottom: '20px' }}>
          <label style={LS}><Timer size={11} /> Duration</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '7px' }}>
            {DURATIONS.map(opt => (
              <motion.button key={opt.value} whileTap={{ scale: 0.94 }} onClick={() => setDuration(opt.value)}
                style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: duration === opt.value ? 'var(--text-primary)' : 'var(--surface)', color: duration === opt.value ? 'var(--accent-fg)' : 'var(--text-primary)', transition: 'all 0.15s' }}>
                {opt.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Keywords */}
        <div style={{ marginBottom: '24px' }}>
          <label style={LS}>
            <Tag size={11} /> Key topics to cover
            {topicMap && <span style={{ fontSize: '10px', color: '#22c55e', textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>— auto-filled from doc</span>}
          </label>
          <div style={{ display: 'flex', gap: '7px', marginBottom: '9px' }}>
            <input value={kwInput} onChange={e => setKwInput(e.target.value)} onKeyDown={onKwKey} placeholder="Add more topics..." style={{ ...IS, marginBottom: 0, flex: 1 }} />
            <motion.button whileTap={{ scale: 0.92 }} onClick={addKeyword} style={{ width: '42px', height: '42px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={15} />
            </motion.button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {keywords.map(kw => (
              <motion.span key={kw} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} whileTap={{ scale: 0.92 }} onClick={() => removeKw(kw)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'var(--blue-bg)', color: 'var(--blue)', borderRadius: '99px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                {kw} <X size={9} />
              </motion.span>
            ))}
          </div>
        </div>

        {error && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--red)', marginBottom: '14px' }}><Warning size={13} />{error}</div>}

        <motion.button whileTap={{ scale: 0.98 }} onClick={handleStart} disabled={loading || docUploading}
          style={{ width: '100%', padding: '13px', background: 'var(--text-primary)', color: 'var(--accent-fg)', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: loading || docUploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading || docUploading ? 0.45 : 1, transition: 'opacity 0.15s', letterSpacing: '-0.01em' }}>
          {loading ? 'Starting…' : docUploading ? 'Analysing document…' : quizDone ? `Start session (${readiness?.readiness_score}% ready) →` : 'Start practice session →'}
        </motion.button>

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </motion.div>

      {/* ── COACH OVERLAY ── */}
      <AnimatePresence>
        {coachOpen && topicMap && !coachMin && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
              style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
            <div style={{ position: 'fixed', inset: 0, zIndex: 201, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ width: '88vw', height: '82vh', position: 'relative', pointerEvents: 'auto' }}>
                {[
                  { key: 'tl', clip: 'inset(0 50% 50% 0)',  v: QV.topLeft     },
                  { key: 'tr', clip: 'inset(0 0 50% 50%)',  v: QV.topRight    },
                  { key: 'bl', clip: 'inset(50% 50% 0 0)',  v: QV.bottomLeft  },
                  { key: 'br', clip: 'inset(50% 0 0 50%)', v: QV.bottomRight },
                ].map(({ key, clip, v }, idx) => (
                  <motion.div key={key} variants={v} initial="hidden" animate="visible" exit="hidden" transition={{ ...QT, delay: idx * 0.055 }}
                    style={{ position: 'absolute', inset: 0, clipPath: clip, borderRadius: '18px', background: 'var(--background,#fff)', border: '1px solid var(--border)', boxShadow: '0 40px 120px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
                    <CoachPanel topicMap={topicMap} duration={duration} timeBreakdown={timeBreakdown} watchTopics={watchTopics}
                      activeTab={activeTab} setActiveTab={setActiveTab} quizDone={quizDone} readiness={readiness}
                      openQuiz={openQuiz} onMinimize={() => { setCoachMin(true); setCurrentStep('setup') }} />
                  </motion.div>
                ))}
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── FLOATING PILL ── */}
      <AnimatePresence>
        {coachOpen && topicMap && coachMin && (
          <motion.button initial={{ opacity: 0, y: 16, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => { setCoachMin(false); setCurrentStep('coach') }}
            style={{ position: 'fixed', bottom: '28px', right: '28px', zIndex: 300, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: 'var(--text-primary)', color: 'var(--accent-fg)', border: 'none', borderRadius: '99px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <Brain size={15} weight="fill" /> Coach Panel
            {quizDone && readiness && <span style={{ fontSize: '11px', fontWeight: 700, color: rColor(readiness.readiness_score), background: 'rgba(255,255,255,0.12)', padding: '1px 7px', borderRadius: '99px' }}>{readiness.readiness_score}%</span>}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── QUIZ OVERLAY ── */}
      <AnimatePresence>
        {quizOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '24px' }}>
            <motion.div initial={{ scale: 0.93, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.93, y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{ background: 'var(--background,#fff)', borderRadius: '16px', width: '100%', maxWidth: '520px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', maxHeight: '85dvh' }}>

              {/* Header */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Brain size={16} weight="fill" color="var(--text-primary)" />
                  <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em' }}>Readiness Quiz</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {quizStarted && !quizDone && !quizBanned && <span style={{ fontSize: '11px', color: 'var(--text-hint)' }}>{qAnswered}/{totalQ} answered</span>}
                  {(quizDone || quizBanned) && (
                    <motion.button whileTap={{ scale: 0.94 }} onClick={() => { setQuizOpen(false); setCurrentStep(quizDone ? 'ready' : 'setup') }}
                      style={{ padding: '6px 14px', background: 'var(--text-primary)', color: 'var(--accent-fg)', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {quizBanned ? 'Close' : 'Done'}
                    </motion.button>
                  )}
                  {!quizStarted && !quizBanned && (
                    <motion.div whileTap={{ scale: 0.85 }} onClick={() => setQuizOpen(false)} style={{ cursor: 'pointer', lineHeight: 0 }}><X size={16} color="var(--text-hint)" /></motion.div>
                  )}
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {quizBanned ? (
                  /* Banned screen */
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '24px 12px' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <Prohibit size={26} color="#ef4444" weight="fill" />
                    </div>
                    <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '10px', letterSpacing: '-0.02em' }}>Quiz session ended</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: '340px', margin: '0 auto 24px' }}>
                      You went off-topic twice. You've been removed from this readiness check. Focus is everything when you present — your audience won't wait either.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <motion.button whileTap={{ scale: 0.96 }} onClick={resetSession}
                        style={{ padding: '10px 20px', border: '1px solid var(--border)', borderRadius: '9px', background: 'var(--surface)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <House size={13} /> Start a new session
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setQuizOpen(false); setCurrentStep('setup') }}
                        style={{ padding: '10px 20px', background: 'var(--text-primary)', color: 'var(--accent-fg)', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowRight size={13} /> Continue without quiz
                      </motion.button>
                    </div>
                  </motion.div>
                ) : !quizStarted ? (
                  /* Pre-quiz */
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <Brain size={36} weight="duotone" color="var(--text-primary)" style={{ margin: '0 auto 16px' }} />
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px', letterSpacing: '-0.02em' }}>Let's make sure you're ready</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: '360px', margin: '0 auto 24px' }}>
                      I'll ask you {totalQ > 0 ? totalQ : 5} questions about your material. Answer as you would in the real presentation. This finds your weak spots before we go live.
                    </p>
                    <motion.button whileTap={{ scale: 0.96 }} onClick={startQuiz}
                      style={{ padding: '11px 28px', background: 'var(--text-primary)', color: 'var(--accent-fg)', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Start quiz →
                    </motion.button>
                  </div>
                ) : (
                  /* Chat */
                  <>
                    {chatHistory.map((msg, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        {msg.role === 'warning' ? (
                          <div style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: msg.banned ? '#fef2f2' : '#fffbeb', border: `1px solid ${msg.banned ? '#fecaca' : '#fde68a'}`, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <Warning size={14} weight="fill" color={msg.banned ? '#ef4444' : '#f59e0b'} style={{ flexShrink: 0, marginTop: '1px' }} />
                            <p style={{ fontSize: '12px', lineHeight: 1.6, color: msg.banned ? '#dc2626' : '#92400e', fontWeight: 500, margin: 0 }}>{msg.text}</p>
                          </div>
                        ) : msg.role === 'result' ? (
                          <div style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
                              <span style={{ fontSize: '32px', fontWeight: 700, color: rColor(msg.score) }}>{msg.score}%</span>
                              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>readiness score</span>
                            </div>
                            <p style={{ fontSize: '13px', lineHeight: 1.6, marginBottom: msg.weakAreas?.length ? '10px' : 0 }}>{msg.text}</p>
                            {msg.weakAreas?.length > 0 && (
                              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                {msg.weakAreas.map((w, j) => <span key={j} style={{ fontSize: '11px', padding: '2px 9px', background: '#fef2f2', color: '#ef4444', borderRadius: '99px', fontWeight: 500 }}>{w}</span>)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ maxWidth: '82%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: msg.role === 'user' ? 'var(--text-primary)' : 'var(--surface)', color: msg.role === 'user' ? 'var(--accent-fg)' : 'var(--text-primary)', border: msg.role === 'coach' ? '1px solid var(--border)' : 'none', fontSize: '13px', lineHeight: 1.6 }}>
                            {msg.text}
                            {msg.score !== undefined && msg.role === 'coach' && msg.score > 0 && (
                              <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 600, color: msg.score >= 7 ? '#22c55e' : msg.score >= 5 ? '#f59e0b' : '#ef4444' }}>
                                {msg.score >= 7 ? '✓ Strong' : msg.score >= 5 ? '~ Partial' : '✗ Needs work'} ({msg.score}/10)
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                    {quizLoading && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', gap: '4px', padding: '4px 0' }}>
                        {[0,1,2].map(i => <motion.div key={i} animate={{ y: [0,-4,0] }} transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.12 }} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-hint)' }} />)}
                      </motion.div>
                    )}
                    <div ref={chatBottomRef} />
                  </>
                )}
              </div>

              {/* Input */}
              {quizStarted && !quizDone && !quizBanned && (
                <div style={{ borderTop: `1px solid ${offTopicWarned ? '#fde68a' : 'var(--border)'}`, transition: 'border-color 0.3s' }}>
                  {offTopicWarned && (
                    <div style={{ padding: '6px 16px', background: '#fffbeb', fontSize: '11px', color: '#92400e', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Warning size={11} weight="fill" color="#f59e0b" /> Final warning — one more off-topic message ends this quiz
                    </div>
                  )}
                  <div style={{ padding: '12px 16px', display: 'flex', gap: '8px' }}>
                    <input value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={onChatKey}
                      placeholder="Type your answer..." disabled={quizLoading}
                      style={{ flex: 1, padding: '10px 13px', border: `1px solid ${offTopicWarned ? '#fde68a' : 'var(--border)'}`, borderRadius: '8px', background: 'var(--surface)', fontSize: '13px', outline: 'none', fontFamily: 'inherit', color: 'var(--text-primary)', opacity: quizLoading ? 0.5 : 1, transition: 'border-color 0.3s' }} />
                    <motion.button whileTap={{ scale: 0.9 }} onClick={submitAnswer} disabled={quizLoading || !userInput.trim()}
                      style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--text-primary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: quizLoading || !userInput.trim() ? 'not-allowed' : 'pointer', opacity: quizLoading || !userInput.trim() ? 0.4 : 1 }}>
                      <ArrowRight size={15} color="var(--accent-fg)" weight="bold" />
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Step Nav ──────────────────────────────────────────────────────────────────
function StepNav({ steps, completedSteps, currentStep, onNavigate, onReset }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500, height: '52px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: '0' }}>
      <motion.button whileTap={{ scale: 0.95 }} onClick={onReset}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', fontFamily: 'inherit', color: 'var(--text-primary)', marginRight: '20px', padding: '4px 0' }}>
        <House size={14} weight="fill" /> PresentIQ
      </motion.button>
      <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
        {steps.map((step, idx) => {
          const done = completedSteps.includes(step.id)
          const cur  = currentStep === step.id
          const ok   = done || cur
          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
              <motion.button whileTap={ok ? { scale: 0.95 } : {}} onClick={() => ok && onNavigate(step.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '6px', background: cur ? 'var(--text-primary)' : 'transparent', color: cur ? 'var(--accent-fg)' : done ? 'var(--text-primary)' : 'var(--text-hint)', border: 'none', cursor: ok ? 'pointer' : 'default', fontSize: '12px', fontWeight: cur || done ? 600 : 400, fontFamily: 'inherit', transition: 'all 0.15s' }}>
                {done && !cur
                  ? <CheckCircle size={12} weight="fill" color="#22c55e" />
                  : <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: cur ? 'rgba(255,255,255,0.2)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>{idx + 1}</span>
                }
                {step.label}
              </motion.button>
              {idx < steps.length - 1 && <ArrowRight size={12} color="var(--text-hint)" style={{ margin: '0 2px', opacity: done ? 1 : 0.35 }} />}
            </div>
          )
        })}
      </div>
      <motion.button whileTap={{ scale: 0.95 }} onClick={onReset}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--text-hint)', fontFamily: 'inherit', padding: '4px 8px' }}>
        Reset
      </motion.button>
    </div>
  )
}

// ── Coach Panel ───────────────────────────────────────────────────────────────
function CoachPanel({ topicMap, duration, timeBreakdown, watchTopics, activeTab, setActiveTab, quizDone, readiness, openQuiz, onMinimize }) {
  const TABS = [{ id:'brief',label:'Your Brief'},{id:'timeplan',label:'Time Plan'},{id:'topics',label:'Key Topics'},{id:'readiness',label:'Readiness'}]
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans',system-ui,sans-serif", background: 'var(--background,#fff)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 28px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Brain size={17} weight="fill" color="var(--text-primary)" />
          <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '-0.02em' }}>Coach Brief</span>
          <span style={{ fontSize: '11px', padding: '2px 9px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '99px', color: 'var(--text-secondary)' }}>{topicMap.title||'Your presentation'}</span>
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          {TABS.map(t => (
            <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => setActiveTab(t.id)}
              style={{ padding: '7px 15px', border: 'none', borderRadius: '8px 8px 0 0', background: activeTab===t.id?'var(--text-primary)':'transparent', color: activeTab===t.id?'var(--accent-fg)':'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', marginBottom: '-1px' }}>
              {t.label}
              {t.id==='readiness'&&quizDone&&readiness&&<span style={{ marginLeft:'5px',fontSize:'10px',color:rColor(readiness.readiness_score),fontWeight:700 }}>{readiness.readiness_score}%</span>}
            </motion.button>
          ))}
        </div>
        <motion.button whileTap={{ scale: 0.88 }} onClick={onMinimize}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
          <X size={12} /> Minimize
        </motion.button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
        <AnimatePresence mode="wait">
          {activeTab==='brief' && (
            <motion.div key="brief" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.18}}>
              <p style={TL}>What this presentation is about</p>
              <p style={{ fontSize:'16px',lineHeight:1.75,maxWidth:'720px',marginBottom:'32px' }}>{topicMap.doc_summary||'No summary available.'}</p>
              {topicMap.key_points?.length>0&&<>
                <p style={TL}>Key points you must cover</p>
                <div style={{ display:'flex',flexDirection:'column',gap:'10px',maxWidth:'680px' }}>
                  {topicMap.key_points.map((pt,i)=>(
                    <div key={i} style={{ display:'flex',gap:'14px',alignItems:'flex-start' }}>
                      <span style={{ width:'22px',height:'22px',borderRadius:'50%',background:'var(--text-primary)',color:'var(--accent-fg)',fontSize:'11px',fontWeight:700,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center' }}>{i+1}</span>
                      <p style={{ fontSize:'14px',lineHeight:1.6,margin:0 }}>{pt}</p>
                    </div>
                  ))}
                </div>
              </>}
            </motion.div>
          )}
          {activeTab==='timeplan' && (
            <motion.div key="timeplan" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.18}}>
              <p style={TL}>How to use your {Math.round(duration/60)} minutes</p>
              <p style={{ fontSize:'13px',color:'var(--text-secondary)',marginBottom:'28px' }}>The highlighted section is where you should spend most of your time.</p>
              {timeBreakdown.length>0?(
                <div style={{ display:'flex',flexDirection:'column',maxWidth:'640px' }}>
                  {timeBreakdown.map((t,i)=>(
                    <div key={i} style={{ display:'flex',alignItems:'stretch',borderLeft:`3px solid ${t.isKey?'var(--text-primary)':'var(--border)'}`,paddingLeft:'20px',paddingBottom:'28px',position:'relative' }}>
                      <div style={{ position:'absolute',left:'-7px',top:'0',width:'11px',height:'11px',borderRadius:'50%',background:t.isKey?'var(--text-primary)':'var(--border)',border:'2px solid var(--background,#fff)' }} />
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:'10px',marginBottom:'4px' }}>
                          <span style={{ fontSize:'12px',fontWeight:700,color:'var(--text-hint)' }}>{t.start}–{t.end}</span>
                          {t.isKey&&<span style={{ fontSize:'10px',padding:'2px 8px',background:'var(--text-primary)',color:'var(--accent-fg)',borderRadius:'99px',fontWeight:600 }}>Most time here</span>}
                        </div>
                        <p style={{ fontSize:'15px',fontWeight:t.isKey?700:500,margin:0 }}>{t.label}</p>
                        <p style={{ fontSize:'12px',color:'var(--text-hint)',marginTop:'3px' }}>{t.pct}% of total time</p>
                      </div>
                    </div>
                  ))}
                </div>
              ):<p style={{ fontSize:'14px',color:'var(--text-hint)' }}>Upload a structured document to see your time plan.</p>}
            </motion.div>
          )}
          {activeTab==='topics' && (
            <motion.div key="topics" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.18}}>
              <p style={TL}>Pay close attention to these</p>
              <p style={{ fontSize:'13px',color:'var(--text-secondary)',marginBottom:'24px' }}>These are the terms your audience expects you to know cold.</p>
              <div style={{ display:'flex',flexWrap:'wrap',gap:'10px',marginBottom:'36px' }}>
                {watchTopics.map((t,i)=><span key={i} style={{ padding:'8px 18px',background:'var(--blue-bg)',color:'var(--blue)',borderRadius:'99px',fontSize:'14px',fontWeight:600 }}>{t}</span>)}
              </div>
              {topicMap.key_questions_to_answer?.length>0&&<>
                <p style={TL}>Questions your audience will ask</p>
                <div style={{ display:'flex',flexDirection:'column',gap:'12px',maxWidth:'640px' }}>
                  {topicMap.key_questions_to_answer.map((q,i)=>(
                    <div key={i} style={{ padding:'14px 18px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px',fontSize:'14px',lineHeight:1.6 }}>"{q}"</div>
                  ))}
                </div>
              </>}
            </motion.div>
          )}
          {activeTab==='readiness' && (
            <motion.div key="readiness" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.18}}>
              {!quizDone?(
                <div style={{ maxWidth:'480px' }}>
                  <p style={TL}>Are you ready?</p>
                  <p style={{ fontSize:'15px',lineHeight:1.75,marginBottom:'28px' }}>Before we start, I'll ask you a few questions about your material. This finds your weak spots before you go live.</p>
                  <motion.button whileTap={{ scale:0.96 }} onClick={openQuiz}
                    style={{ display:'flex',alignItems:'center',gap:'8px',padding:'13px 28px',background:'var(--text-primary)',color:'var(--accent-fg)',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>
                    <ChatCircle size={16} weight="fill" /> Take the readiness quiz
                  </motion.button>
                </div>
              ):(
                <div style={{ maxWidth:'560px' }}>
                  <p style={TL}>Your readiness score</p>
                  <div style={{ display:'flex',alignItems:'baseline',gap:'8px',marginBottom:'16px' }}>
                    <span style={{ fontSize:'72px',fontWeight:800,lineHeight:1,color:rColor(readiness?.readiness_score),letterSpacing:'-0.04em' }}>{readiness?.readiness_score}</span>
                    <span style={{ fontSize:'24px',color:'var(--text-hint)',fontWeight:500 }}>/ 100</span>
                  </div>
                  <p style={{ fontSize:'15px',lineHeight:1.7,marginBottom:'24px' }}>{readiness?.message}</p>
                  {readiness?.weak_areas?.length>0&&<>
                    <p style={TL}>Review before you present</p>
                    <div style={{ display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'20px' }}>
                      {readiness.weak_areas.map((w,i)=><span key={i} style={{ padding:'6px 14px',background:'#fef2f2',color:'#dc2626',borderRadius:'99px',fontSize:'13px',fontWeight:600 }}>{w}</span>)}
                    </div>
                  </>}
                  {readiness?.strong_areas?.length>0&&<>
                    <p style={TL}>Strong areas</p>
                    <div style={{ display:'flex',gap:'8px',flexWrap:'wrap' }}>
                      {readiness.strong_areas.map((s,i)=><span key={i} style={{ padding:'6px 14px',background:'#f0fdf4',color:'#16a34a',borderRadius:'99px',fontSize:'13px',fontWeight:600 }}>{s}</span>)}
                    </div>
                  </>}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const LS = { display:'flex',alignItems:'center',gap:'5px',fontSize:'11px',letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text-secondary)',marginBottom:'7px',fontWeight:600 }
const IS = { width:'100%',padding:'11px 13px',border:'1px solid var(--border)',borderRadius:'8px',background:'var(--surface)',fontSize:'14px',outline:'none',fontFamily:'inherit',color:'var(--text-primary)',boxSizing:'border-box' }
const TL = { fontSize:'11px',letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text-hint)',fontWeight:700,marginBottom:'12px' }

function Spinner() {
  return <div style={{ width:'14px',height:'14px',borderRadius:'50%',border:'2px solid var(--border)',borderTopColor:'var(--text-primary)',animation:'spin 0.7s linear infinite',flexShrink:0 }} />
}