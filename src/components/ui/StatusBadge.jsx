import { estadoColor } from '../../utils/helpers'

// Pill de estado uniforme. Acepta `tone` opcional (success | danger | warning | info | muted | primary).
export default function StatusBadge({ children, tone, dot = true, style: extra = {} }) {
  let style = { bg: 'var(--muted-bg)', color: 'var(--muted-text)' }
  if (tone === 'success') style = { bg: 'var(--success-bg)', color: 'var(--success-text)' }
  else if (tone === 'danger') style = { bg: 'var(--danger-bg)', color: 'var(--danger-text)' }
  else if (tone === 'warning') style = { bg: 'var(--warning-bg)', color: 'var(--warning-text)' }
  else if (tone === 'info') style = { bg: 'var(--info-bg)', color: 'var(--info-text)' }
  else if (tone === 'muted') style = { bg: 'var(--muted-bg)', color: 'var(--muted-text)' }
  else if (tone === 'primary') style = { bg: 'var(--primary-soft)', color: 'var(--primary)' }
  else style = estadoColor(children)

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '3px 10px',
      borderRadius: '999px',
      background: style.bg,
      color: style.color,
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '0.2px',
      whiteSpace: 'nowrap',
      ...extra,
    }}>
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'currentColor',
        }}/>
      )}
      {children}
    </span>
  )
}
