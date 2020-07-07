export function smartTruncate(s, length, useWordboundary = true) {
  if (s.length <= length) {
    return s;
  }
  const substring = s.substr(0, length - 1);
  return (useWordboundary ? substring.substr(0, substring.lastIndexOf(' ')) : substring) + '—';
}
