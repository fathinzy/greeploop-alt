import { QRCodeSVG } from 'qrcode.react'
import { useStore } from '../store/StoreContext.jsx'
import { formatRm } from '../lib/engine.js'
import { Button } from './ui.jsx'
import Barcode from './Barcode.jsx'

// Full-screen modal showing a redeemed voucher's QR, barcode and code,
// with a "Mark as Used" action. Present this at the mall tenant to redeem.
export default function VoucherModal({ voucher, onClose }) {
  const { dispatch } = useStore()
  if (!voucher) return null

  // Encode useful info into the QR payload.
  const payload = JSON.stringify({
    v: voucher.code,
    name: voucher.name,
    value: voucher.value,
    ts: voucher.timestamp,
  })

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between bg-gradient-to-br from-green-600 to-emerald-500 px-5 py-4 text-white">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-green-50">Voucher</p>
            <p className="text-lg font-bold">
              {voucher.emoji} {formatRm(voucher.value)}
            </p>
            <p className="text-sm text-green-50">{voucher.name}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-green-50 hover:bg-white/20"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {voucher.used ? (
            <div className="rounded-xl bg-slate-100 p-6 text-center">
              <p className="text-3xl">✅</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">Voucher already used</p>
              {voucher.usedAt && (
                <p className="text-xs text-slate-400">
                  {new Date(voucher.usedAt).toLocaleString('en-MY')}
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="text-center text-xs text-slate-500">
                Show this at the counter to redeem
              </p>
              <div className="flex justify-center">
                <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                  <QRCodeSVG value={payload} size={160} level="M" />
                </div>
              </div>
              <div className="rounded-lg ring-1 ring-slate-200">
                <Barcode value={voucher.code} className="h-14 w-full rounded-t-lg" />
                <p className="py-1 text-center font-mono text-sm tracking-widest text-slate-700">
                  {voucher.code}
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => dispatch({ type: 'MARK_VOUCHER_USED', id: voucher.id })}
              >
                Mark as Used
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
