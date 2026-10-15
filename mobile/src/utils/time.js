export function timeAgo(ts, ref) {
  if (!ts) return 'no data';
  const s = Math.max(0, ref - ts);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export function clock(ts) {
  return new Date(ts * 1000).toISOString().slice(11, 19) + ' UTC';
}