export function Toggle({ on, onChange, disabled }) {
  return (
    <label className="toggle" style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  )
}

export function StepBar({ steps, current }) {
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          {i > 0 && <div style={{
            position: 'absolute', left: '-50%', top: 12, width: '100%', height: 2,
            background: i <= current ? 'var(--accent)' : 'var(--border)',
            transition: 'background 0.3s',
          }} />}
          <div style={{
            width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: i < current ? 'var(--green)' : i === current ? 'var(--accent)' : 'var(--bg4)',
            color: i <= current ? '#fff' : 'var(--text3)',
            fontSize: 11, fontWeight: 600, zIndex: 1, transition: 'all 0.3s',
            border: i === current ? '2px solid var(--accent2)' : '2px solid transparent',
          }}>
            {i < current ? '✓' : i + 1}
          </div>
          <div style={{
            fontSize: 10, marginTop: 4, fontWeight: i === current ? 600 : 400,
            color: i === current ? 'var(--text)' : 'var(--text3)',
          }}>{s}</div>
        </div>
      ))}
    </div>
  )
}

export function FileDropzone({ label, accept, hint, onChange, preview }) {
  return (
    <div
      style={{
        border: '2px dashed var(--border2)', borderRadius: 'var(--radius)',
        padding: '20px', textAlign: 'center', cursor: 'pointer',
        background: 'var(--bg3)', transition: 'border-color 0.15s',
        position: 'relative', overflow: 'hidden',
      }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); onChange && onChange(e.dataTransfer.files[0]) }}
    >
      <input type="file" accept={accept} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
        onChange={e => onChange && onChange(e.target.files[0])} />
      {preview
        ? <img src={preview} alt="preview" style={{ maxHeight: 100, borderRadius: 6, marginBottom: 8 }} />
        : <div style={{ fontSize: 24, marginBottom: 8 }}>📁</div>
      }
      <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

export function SortableRow({ children, onMoveUp, onMoveDown, disableUp, disableDown }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button onClick={onMoveUp} disabled={disableUp} style={{
          background: 'none', border: 'none', cursor: disableUp ? 'default' : 'pointer',
          color: disableUp ? 'var(--text3)' : 'var(--text2)', padding: 2, fontSize: 10,
        }}>▲</button>
        <button onClick={onMoveDown} disabled={disableDown} style={{
          background: 'none', border: 'none', cursor: disableDown ? 'default' : 'pointer',
          color: disableDown ? 'var(--text3)' : 'var(--text2)', padding: 2, fontSize: 10,
        }}>▼</button>
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 380, width: '100%',
        margin: '0 20px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {danger ? 'Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
