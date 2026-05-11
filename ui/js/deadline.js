// deadline.js — aggregation and relative time formatting
// Depends on: data.js (makeItem, emptyData — loaded before this file)

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// Returns human-readable relative label for an ISO date string.
// today param is optional; defaults to new Date() for production use.
function relativeLabel(isoDate, today = new Date()) {
  const target = new Date(isoDate)
  const diff = daysDiff(midnight(today), midnight(target))

  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff <= 6)  return `本周${WEEKDAYS[target.getDay()]}`
  if (diff <= 13) return `下周${WEEKDAYS[target.getDay()]}`
  return isoDate.slice(5)   // MM-DD for anything 2+ weeks away
}

// Returns CSS urgency class name for a deadline ISO date string.
function urgencyClass(isoDate, today = new Date()) {
  const diff = daysDiff(midnight(today), midnight(new Date(isoDate)))
  if (diff <= 1)  return 'urgency-critical'
  if (diff <= 6)  return 'urgency-week'
  if (diff <= 13) return 'urgency-next'
  return 'urgency-far'
}

// Collect all nodes (any depth) that have a deadline field set,
// from main/side/fun quadrants, plus standalone items from deadline quadrant.
// Results are sorted by deadline ascending.
function collectDeadlineItems(data) {
  const results = []
  const q = data.quadrants
  for (const key of ['main', 'side', 'fun']) {
    walkItems(q[key].items, results)
  }
  for (const item of q.deadline.standalone) {
    if (item.deadline) results.push(item)
  }
  return results.sort((a, b) => a.deadline.localeCompare(b.deadline))
}

function walkItems(items, results) {
  for (const item of items) {
    if (item.deadline) results.push(item)
    if (item.children && item.children.length) walkItems(item.children, results)
  }
}

function midnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function daysDiff(a, b) {
  return Math.round((b - a) / 86400000)
}
