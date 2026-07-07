const LOGO_RATIO = 1304 / 344

export function ExportLogo({ height = 54 }: { height?: number }) {
  const width = Math.round(height * LOGO_RATIO)

  return (
    <img
      src="/elbakri-logo-blue.png"
      alt="ELBAKRI OVERSEAS"
      draggable={false}
      style={{
        display: 'block',
        width,
        height,
        minWidth: width,
        maxWidth: width,
        minHeight: height,
        maxHeight: height,
        objectFit: 'contain',
        flex: '0 0 auto',
      }}
    />
  )
}
