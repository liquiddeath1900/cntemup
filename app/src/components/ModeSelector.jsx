// Mode toggle — SCAN (ML detection) vs TALLY (manual/tripwire counting)
export function ModeSelector({ mode, setMode }) {
  return (
    <div className="mode-selector">
      <button
        className={`mode-btn ${mode === 'scan' ? 'mode-btn-active' : ''}`}
        onClick={() => setMode('scan')}
      >
        SCAN
      </button>
      <button
        className={`mode-btn ${mode === 'tally' ? 'mode-btn-active' : ''}`}
        onClick={() => setMode('tally')}
      >
        TALLY
      </button>
    </div>
  )
}
