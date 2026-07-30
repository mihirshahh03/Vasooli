export default function Modal({ title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {title && <h3>{title}</h3>}
        {body && <p className="modal-body">{body}</p>}
        <div className="modal-actions">
          <button className="btn-link" onClick={onCancel}>Cancel</button>
          <button
            className={danger ? 'btn-primary btn-danger' : 'btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Simpler variant: just an acknowledgement, no cancel. */
export function AlertModal({ title, body, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {title && <h3>{title}</h3>}
        {body && <p className="modal-body">{body}</p>}
        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  )
}
