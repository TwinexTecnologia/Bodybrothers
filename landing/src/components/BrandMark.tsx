import fitbodyIcon from '../assets/fitbody-icon.png'

type BrandMarkProps = {
  compact?: boolean
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className={`brand-mark ${compact ? 'brand-mark-compact' : ''}`}>
      <img src={fitbodyIcon} alt="FitBodyPro" className="brand-mark-image" />
      <div>
        <p className="brand-mark-title">
          FitBody<span>Pro</span>
        </p>
        {!compact && <p className="brand-mark-subtitle">Tecnologia para performance e escala</p>}
      </div>
    </div>
  )
}
