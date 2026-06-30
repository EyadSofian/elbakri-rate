import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { PageHeader, PageLoader } from '@/components/ui/misc'
import { MatrixBuilder } from '@/components/MatrixBuilder'
import { useI18n } from '@/lib/i18n'
import type { Package } from '@/types'

export default function PackageAddRatesPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { data: pkg, isLoading } = useQuery({ queryKey: ['package', id], queryFn: () => api.get<Package>(`/packages/${id}`) })

  if (isLoading) return <PageLoader />

  return (
    <div>
      <Link to={`/packages/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-navy-600 hover:text-navy-800">
        <ArrowRight className="h-4 w-4 ltr:rotate-180" />{pkg?.package_name ?? t('nav.packages')}
      </Link>
      <PageHeader title={t('package.addRatesTitle')} subtitle={pkg?.package_name} />
      <MatrixBuilder
        fixedPackageId={Number(id)}
        presetHotelIds={pkg?.hotels?.map((h) => h.id) ?? []}
        onDone={() => navigate(`/packages/${id}`)}
      />
    </div>
  )
}
