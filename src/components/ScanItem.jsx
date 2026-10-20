import { useRef, useState } from 'react'
import { SCAN_TARGETS } from '../data/catalog.js'
import { Button } from './ui.jsx'
import ItemImage from './ItemImage.jsx'
import { MIN_SCORE, loadModel, toDetection } from '../lib/vision.js'

// Simulated computer-vision scan with two sources:
//  - Example: pick a generated example photo; a mock model returns a verdict.
//  - Upload: upload a real image; it is classified for real with COCO-SSD.
// Only recyclable results unlock drop-off (handled by parent via onAccepted).
export default function ScanItem({ onAccepted }) {
  const [source, setSource] = useState('example') // 'example' | 'upload'

  // --- Example mode state ---
  const [targetId, setTargetId] = useState(SCAN_TARGETS[0].id)
  const [phase, setPhase] = useState('idle') // idle | scanning | done
  const [result, setResult] = useState(null)
  const target = SCAN_TARGETS.find((t) => t.id === targetId)

  // --- Upload mode state ---
  const fileRef = useRef(null)
  const imgRef = useRef(null)
  const [imgUrl, setImgUrl] = useState(null)
  const [uploadPhase, setUploadPhase] = useState('idle') // idle | analysing | done
  const [uploadDetections, setUploadDetections] = useState([])

  function reset() {
    setPhase('idle')
    setResult(null)
    setUploadPhase('idle')
    setUploadDetections([])
    onAccepted?.(null)
  }

  function switchSource(s) {
    setSource(s)
    reset()
    setImgUrl(null)
  }

  // ---- Example mode ----
  function selectExample(id) {
    setTargetId(id)
    setPhase('idle')
    setResult(null)
    onAccepted?.(null)
  }

  function runExampleScan() {
    setPhase('scanning')
    setResult(null)
    onAccepted?.(null)
    setTimeout(() => {
      const [lo, hi] = target.confidence
      const confidence = Math.round(lo + Math.random() * (hi - lo))
      const res = {
        label: target.label,
        emoji: target.emoji,
        recyclable: target.recyclable,
        itemId: target.itemId || null,
        reason: target.reason || null,
        confidence,
      }
      setResult(res)
      setPhase('done')
      onAccepted?.(res.recyclable ? res : null)
    }, 1000)
  }

  // ---- Upload mode ----
  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImgUrl(URL.createObjectURL(file))
    setUploadPhase('idle')
    setUploadDetections([])
    onAccepted?.(null)
  }

  async function runUploadScan() {
    if (!imgRef.current) return
    setUploadPhase('analysing')
    onAccepted?.(null)
    try {
      const model = await loadModel()
      const preds = (await model.detect(imgRef.current)).filter((p) => p.score >= MIN_SCORE)
      const list = preds.map(toDetection)
      setUploadDetections(list)
      setUploadPhase('done')
      const tally = {}
      for (const d of list) if (d.recyclable) tally[d.itemId] = (tally[d.itemId] || 0) + 1
      const items = Object.entries(tally).map(([itemId, quantity]) => ({ itemId, quantity }))
      onAccepted?.(items.length ? { items, detections: list } : null)
    } catch {
      setUploadPhase('done')
      setUploadDetections([])
      onAccepted?.(null)
    }
  }

  const boxColor = !result ? '#38bdf8' : result.recyclable ? '#22c55e' : '#ef4444'
  const uploadRecyclable = uploadDetections.filter((d) => d.recyclable).length
  const uploadReject = uploadDetections.length - uploadRecyclable

  return (
    <div className="space-y-4">
      {/* Source toggle */}
      <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
        {[
          { id: 'example', label: 'Example Photo' },
          { id: 'upload', label: 'Upload Image' },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => switchSource(s.id)}
            className={`rounded-md px-2.5 py-1 transition ${
              source === s.id ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {source === 'example' ? (
        <>
          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">
              Choose an example photo to analyse:
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {SCAN_TARGETS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectExample(t.id)}
                  className={`overflow-hidden rounded-lg border transition ${
                    targetId === t.id
                      ? 'border-green-500 ring-1 ring-green-500'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  title={t.label}
                >
                  <ItemImage id={t.id} className="aspect-square w-full" />
                </button>
              ))}
            </div>
          </div>

          <div className="relative mx-auto aspect-square w-56 overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-700">
            <ItemImage id={targetId} className="h-full w-full" />
            {phase === 'scanning' && (
              <div className="absolute inset-x-0 top-0 h-0.5 animate-[scanline_1s_linear_infinite] bg-sky-400 shadow-[0_0_8px_2px_rgba(56,189,248,0.7)]" />
            )}
            {phase !== 'idle' && (
              <div
                className="absolute left-[20%] top-[16%] h-[68%] w-[60%] rounded-md border-2 transition-colors"
                style={{ borderColor: boxColor }}
              >
                <span
                  className="absolute -top-5 left-0 rounded px-1 text-[10px] font-semibold text-white"
                  style={{ backgroundColor: boxColor }}
                >
                  {phase === 'scanning' ? 'detecting…' : `${result.label} ${result.confidence}%`}
                </span>
              </div>
            )}
          </div>

          <Button onClick={runExampleScan} className="w-full" disabled={phase === 'scanning'}>
            {phase === 'scanning' ? 'Analysing…' : '🔍 Scan Item'}
          </Button>

          {phase === 'done' && result && (
            <div
              className={`animate-fade-slide rounded-xl p-4 ring-1 ${
                result.recyclable ? 'bg-green-50 ring-green-200' : 'bg-red-50 ring-red-200'
              }`}
            >
              {result.recyclable ? (
                <p className="text-sm font-semibold text-green-800">
                  ✅ Recyclable — you can drop this at the Smart Hub.
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-red-700">❌ Not recyclable</p>
                  <p className="mt-1 text-xs text-red-600">{result.reason}</p>
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="relative mx-auto aspect-square w-56 overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-700">
            {imgUrl ? (
              <img
                ref={imgRef}
                src={imgUrl}
                alt="uploaded item"
                crossOrigin="anonymous"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
                🖼️ Upload a photo of an item
              </div>
            )}
            {uploadPhase === 'analysing' && (
              <div className="absolute inset-x-0 top-0 h-0.5 animate-[scanline_1s_linear_infinite] bg-sky-400 shadow-[0_0_8px_2px_rgba(56,189,248,0.7)]" />
            )}
          </div>

          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => fileRef.current?.click()} className="flex-1">
              Choose Image
            </Button>
            <Button
              onClick={runUploadScan}
              disabled={!imgUrl || uploadPhase === 'analysing'}
              className="flex-1"
            >
              {uploadPhase === 'analysing' ? 'Analysing…' : '🔍 Scan Image'}
            </Button>
          </div>

          {uploadPhase === 'done' && (
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
              {uploadDetections.length === 0 ? (
                <p className="text-sm text-red-600">
                  ❌ No recyclable item recognised. Try a clearer photo of a bottle, cup or phone.
                </p>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Detected objects</span>
                    <span>
                      <span className="text-green-600">{uploadRecyclable} recyclable</span>
                      {' · '}
                      <span className="text-red-500">{uploadReject} rejected</span>
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {uploadDetections.map((d, i) => (
                      <li
                        key={`${d.class}-${i}`}
                        className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-sm ring-1 ring-slate-100"
                      >
                        <span className="flex items-center gap-2">
                          <span>{d.recyclable ? '✅' : '❌'}</span>
                          <span className="font-medium text-slate-700">{d.label}</span>
                          <span className="text-xs text-slate-400">({d.confidence}%)</span>
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            d.recyclable ? 'text-green-600' : 'text-red-500'
                          }`}
                        >
                          {d.recyclable ? 'recyclable' : 'not accepted'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          <p className="text-xs text-slate-400">
            Uploaded images are classified in your browser with TensorFlow.js COCO-SSD. Nothing is uploaded to a server.
          </p>
        </>
      )}

      <style>{`@keyframes scanline { 0% { transform: translateY(0) } 100% { transform: translateY(224px) } }`}</style>
    </div>
  )
}
