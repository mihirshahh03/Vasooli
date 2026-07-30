const TABS = [
  { key: 'expenses', label: 'Expenses', icon: '🧾' },
  { key: 'activity', label: 'Activity', icon: '📋' },
  { key: 'summary', label: 'Summary', icon: '📊' },
]

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`bottom-nav-btn ${active === t.key ? 'active' : ''}`}
          onClick={() => onChange(t.key)}
          type="button"
        >
          <span className="bottom-nav-icon">{t.icon}</span>
          <span className="bottom-nav-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
