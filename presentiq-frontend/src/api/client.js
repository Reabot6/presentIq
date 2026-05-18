// src/api/client.js
// ── URL resolution ──────────────────────────────────────────────────────────
// In development: VITE_API_URL is not set → falls back to localhost
// In production:  VITE_API_URL = https://your-backend.railway.app
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// WebSocket uses wss:// in production (Railway serves HTTPS), ws:// in dev
const WS_BASE = BASE_URL
  .replace(/^https:\/\//, 'wss://')
  .replace(/^http:\/\//, 'ws://')

import axios from 'axios'

export const api = axios.create({ baseURL: BASE_URL })

// ── REST endpoints ───────────────────────────────────────────────────────────
export const createSession = (data) => api.post('/api/sessions/', data)
export const getSession = (id) => api.get(`/api/sessions/${id}`)
export const getSessions = () => api.get('/api/sessions/')

export const analyzeAudio = (formData) =>
  api.post('/api/analysis/audio', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const uploadDocument = async (file, sessionTitle = 'My Presentation') => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('session_title', sessionTitle)
  const res = await api.post('/api/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export const getRealtimeFeedback = (data) =>
  api.post('/api/feedback/realtime', data)

// ── WebSocket factory ─────────────────────────────────────────────────────────
// Automatically switches ws:// ↔ wss:// based on environment
export const createWebSocket = (sessionId) =>
  new WebSocket(`${WS_BASE}/ws/${sessionId}`)