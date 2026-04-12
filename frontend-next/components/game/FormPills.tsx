interface Props { form?: string; max?: number }

const COLORS = {
  W: { bg: 'rgba(52,211,153,0.2)',  text: '#34d399', border: 'rgba(52,211,153,0.4)'  },
  D: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', border: 'rgba(251,191,36,0.3)'  },
  L: { bg: 'rgba(248,113,113,0.15)',text: '#f87171', border: 'rgba(248,113,113,0.3)' },
}

export function FormPills({ form = '', max = 5 }: Props) {
  const chars = form.slice(0, max).split('')
  return (
    <div className="flex gap-1">
      {chars.map((c, i) => {
        const col = COLORS[c as keyof typeof COLORS] ?? COLORS.D
        return (
          <span
            key={i}
            className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold font-mono"
            style={{ backgroundColor: col.bg, color: col.text, border: `1px solid ${col.border}` }}
          >
            {c}
          </span>
        )
      })}
    </div>
  )
}
