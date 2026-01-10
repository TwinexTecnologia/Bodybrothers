import type { PersonalRecord } from '../store/personals'

export default function PersonalBadge({ personal }: { personal: PersonalRecord | null }) {
  if (!personal) return null
  const b = personal.branding
  return (
    <div className="login-card" style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {b?.logoUrl ? <img src={b.logoUrl} alt="logo" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} /> : <div className="brand-mark" />}
        <div>
          <div style={{ fontWeight: 600 }}>{personal.name}</div>
          <div style={{ color: '#64748b' }}>{personal.email}</div>
          {b?.brandName && <div style={{ color: '#334155' }}>{b.brandName}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        {b?.sidebarColor && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, background: b.sidebarColor, display: 'inline-block' }} />
            <span style={{ color: '#64748b' }}>Menu</span>
          </div>
        )}
        {b?.buttonColor && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, background: b.buttonColor, display: 'inline-block' }} />
            <span style={{ color: '#64748b' }}>Botões</span>
          </div>
        )}
        {b?.accentColor && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, background: b.accentColor, display: 'inline-block' }} />
            <span style={{ color: '#64748b' }}>Destaque</span>
          </div>
        )}
      </div>
    </div>
  )
}
