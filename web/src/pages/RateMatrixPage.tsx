import { PageHeader } from '@/components/ui/misc'
import { MatrixBuilder } from '@/components/MatrixBuilder'
import { useI18n } from '@/lib/i18n'

export default function RateMatrixPage() {
  const { t } = useI18n()
  return (
    <div>
      <PageHeader title={t('nav.matrix')} subtitle={t('matrixPage.subtitle')} />
      <MatrixBuilder />
    </div>
  )
}
