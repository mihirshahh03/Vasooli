import { Receipt, ListTree, PieChart } from 'lucide-react'

const TABS = [
  { key: 'expenses', label: 'Expenses', Icon: Receipt },
  { key: 'activity', label: 'Activity', Icon: ListTree },
  { key: 'summary', label: 'Summary', Icon: PieChart },
]

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {TABS.map(({ key, label, Icon }) => (
        <button
          key={key}
          className={`bottom-nav-btn ${active === key ? 'active' : ''}`}
          onClick={() => onChange(key)}
          type="button"
        >
          <Icon size={20} strokeWidth={active === key ? 2.4 : 1.8} />
          <span className="bottom-nav-label">{label}</span>
        </button>
      ))}
    </nav>
  )
}
