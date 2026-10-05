const COLORS = ['#e17076', '#7bc862', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774']

interface Props {
  seed: string
  name: string
}

export function Avatar({ seed, name }: Props) {
  let hash = 0
  for (const char of seed) hash = (hash + char.charCodeAt(0)) % COLORS.length
  const initial = name.match(/[\p{L}\p{N}]/u)?.[0].toUpperCase() ?? '#'

  return (
    <span className="avatar" style={{ background: COLORS[hash] }} aria-hidden="true">
      {initial}
    </span>
  )
}
