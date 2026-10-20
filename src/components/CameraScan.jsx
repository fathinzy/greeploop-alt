import { useEffect, useRef, useState } from 'react'
import { Button } from './ui.jsx'
import { MIN_SCORE, loadModel, toDetection } from '../lib/vision.js'

export default function CameraScan({ onAccepted }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const modelRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | loading | running | error | denied
  const [detections, setDetections] = useState([]) // [{ class, label, itemId, recyclable, confidence }]
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => () => stop(), [])

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const v = videoRef.current
    if (v && v.srcObject) {
      v.srcObject.getTracks().forEach((t) => t.stop())
      v.srcObject = null
    }
  }

  async function start() {
    setStatus('loading')
    setErrorMsg('')
    setDetections([])
    onAccepted?.(null)
    try {
      if (!modelRef.current) modelRef.current = await loadModel()

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      const v = videoRef.current
      v.srcObject = stream
      await v.play()
      setStatus('running')
      detectLoop()
    } catch (err) {
      stop()
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        setStatus('denied')
      } else {
        setStatus('error')
        setErrorMsg(err?.message || 'Could not start the camera or model.')
      }
      onAccepted?.(null)
    }
  }

  function drawBoxes(preds) {
    const canvas = canvasRef.current
    const v = videoRef.current
    if (!canvas || !v) return
    canvas.width = v.videoWidth || canvas.clientWidth
    canvas.height = v.videoHeight || canvas.clientHeight
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const p of preds) {
      const d = toDetection(p)
      const color = d.recyclable ? '#22c55e' : '#ef4444'
      const [x, y, w, h] = p.bbox
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, w, h)
      ctx.fillStyle = color
      const label = `${d.label} ${d.confidence}%`
      ctx.font = '14px sans-serif'
      const tw = ctx.measureText(label).width + 8
      ctx.fillRect(x, Math.max(0, y - 18), tw, 18)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, x + 4, Math.max(12, y - 5))
    }
  }

  async function detectLoop() {
    const v = videoRef.current
    const model = modelRef.current
    if (!v || !model || v.readyState < 2) {
      rafRef.current = requestAnimationFrame(detectLoop)
      return
    }
    let preds = []
    try {
      preds = await model.detect(v)
    } catch {
      /* transient */
    }
    const kept = preds.filter((p) => p.score >= MIN_SCORE)
    drawBoxes(kept)

    // Build per-object detection list with verdicts.
    const list = kept.map(toDetection)
    setDetections(list)

    // Tally recyclable detections into per-item quantities.
    const tally = {}
    for (const d of list) {
      if (d.recyclable) tally[d.itemId] = (tally[d.itemId] || 0) + 1
    }
    const items = Object.entries(tally).map(([itemId, quantity]) => ({ itemId, quantity }))
    onAccepted?.(items.length ? { items, detections: list } : null)

    rafRef.current = requestAnimationFrame(detectLoop)
  }

  const recyclableCount = detections.filter((d) => d.recyclable).length
  const rejectCount = detections.length - recyclableCount

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-xl bg-slate-900">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        {status !== 'running' && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-slate-300">
            {status === 'idle' && <span>📷 Camera off — press "Start Camera"</span>}
            {status === 'loading' && <span>⏳ Loading vision model and camera…</span>}
            {status === 'denied' && (
              <span className="text-red-300">Camera permission denied. Allow access or use Simulated mode.</span>
            )}
            {status === 'error' && <span className="text-red-300">⚠️ {errorMsg} Try Simulated mode.</span>}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {status !== 'running' ? (
          <Button onClick={start} className="flex-1" disabled={status === 'loading'}>
            {status === 'loading' ? 'Loading…' : '📷 Start Camera'}
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => { stop(); setStatus('idle'); setDetections([]); onAccepted?.(null) }}
            className="flex-1"
          >
            Stop Camera
          </Button>
        )}
      </div>

      {/* Per-object detection list (real multi-class scenario) */}
      {status === 'running' && (
        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>Detected objects</span>
            <span>
              <span className="text-green-600">{recyclableCount} recyclable</span>
              {' · '}
              <span className="text-red-500">{rejectCount} rejected</span>
            </span>
          </div>
          {detections.length === 0 ? (
            <p className="text-sm text-slate-400">🔍 Point the camera at items (bottle, cup, phone…).</p>
          ) : (
            <ul className="space-y-1">
              {detections.map((d, i) => (
                <li
                  key={`${d.class}-${i}`}
                  className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-sm ring-1 ring-slate-100"
                >
                  <span className="flex items-center gap-2">
                    <span>{d.recyclable ? '✅' : '❌'}</span>
                    <span className="font-medium text-slate-700">{d.label}</span>
                    <span className="text-xs text-slate-400">({d.confidence}%)</span>
                  </span>
                  <span className={`text-xs font-semibold ${d.recyclable ? 'text-green-600' : 'text-red-500'}`}>
                    {d.recyclable ? 'recyclable' : 'not accepted'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400">
        Live detection uses TensorFlow.js COCO-SSD in your browser. Nothing is uploaded.
        Recyclable items are tallied into drop-off quantities automatically.
      </p>
    </div>
  )
}
