function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateString).toLocaleDateString()
}

export default function Activity({ items, loading }) {
  if (loading) {
    return (
      <div className="stack-list">
        <div className="skeleton-row" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="hint">Nothing's happened yet — add an expense to see activity here.</p>
  }

  return (
    <div className="stack-list">
      {items.map((item) => (
        <div key={item.id} className="activity-row">
          <span>{item.message}</span>
          <span className="expense-meta">{timeAgo(item.created_at)}</span>
        </div>
      ))}
    </div>
  )
}
