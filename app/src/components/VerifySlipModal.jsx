import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Modal for uploading a redemption slip photo to verify a session
export function VerifySlipModal({ sessionId, onClose, onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Please sign in to verify')
        setUploading(false)
        return
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('session_id', sessionId)

      const res = await fetch('/api/upload-slip', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Upload failed (${res.status})`)
      }

      onUploaded?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content verify-slip-modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">VERIFY SESSION</h2>
        <p className="modal-desc">
          Photo your redemption slip to get a verified badge on the leaderboard
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="slip-file-input"
        />

        {error && <p className="slip-error">{error}</p>}

        <div className="slip-actions">
          <button
            className="gb-action-btn gb-save-btn"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'UPLOADING...' : 'UPLOAD'}
          </button>
          <button className="gb-clear-btn" onClick={onClose}>
            SKIP
          </button>
        </div>
      </div>
    </div>
  )
}
