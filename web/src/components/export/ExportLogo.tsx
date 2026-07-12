const LOGO_RATIO = 1304 / 344

export function ExportLogo({
  height,
  h,
  variant = 'blue',
}: {
  height?: number
  h?: number
  variant?: 'blue' | 'white'
}) {
  const finalHeight = height ?? h ?? 54
  const width = Math.round(finalHeight * LOGO_RATIO)

  return (
    <img
      src={variant === 'white' ? '/elbakri-logo-white.png' : '/elbakri-logo-blue.png'}
      alt="ELBAKRI OVERSEAS"
      width={width}
      height={finalHeight}
      draggable={false}
      style={{
        display: 'block',
        width,
        height: finalHeight,
        minWidth: width,
        maxWidth: width,
        minHeight: finalHeight,
        maxHeight: finalHeight,
        objectFit: 'contain',
        flex: '0 0 auto',
      }}
    />
  )
}
