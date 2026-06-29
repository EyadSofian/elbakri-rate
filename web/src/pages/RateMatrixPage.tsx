import { PageHeader } from '@/components/ui/misc'
import { MatrixBuilder } from '@/components/MatrixBuilder'

export default function RateMatrixPage() {
  return (
    <div>
      <PageHeader title="مصفوفة الأسعار" subtitle="أضف أسعارًا متعددة دفعة واحدة: فنادق × فترات × أنواع غرف" />
      <MatrixBuilder />
    </div>
  )
}
