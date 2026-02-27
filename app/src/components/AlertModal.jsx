// Game Boy overlay — "TARGET REACHED!" modal
export function AlertModal({ target, count, onSave, onKeepCounting }) {
  return (
    <div className="alert-modal-overlay">
      <div className="alert-modal">
        <div className="alert-modal-icon">!</div>
        <h2 className="alert-modal-title">TARGET REACHED!</h2>
        <p className="alert-modal-count">
          {count} / {target}
        </p>
        <p className="alert-modal-text">
          You hit your bag limit!
        </p>
        <div className="alert-modal-actions">
          <button className="alert-modal-btn alert-modal-save" onClick={onSave}>
            SAVE SESSION
          </button>
          <button className="alert-modal-btn alert-modal-continue" onClick={onKeepCounting}>
            KEEP COUNTING
          </button>
        </div>
      </div>
    </div>
  )
}
