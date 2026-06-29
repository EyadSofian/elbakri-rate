import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Package as PackageIcon, Building2, CheckCircle2, MapPin } from 'lucide-react'
import { usePackages } from '@/lib/hooks'
import { PageHeader, PageLoader, EmptyState } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PackageForm } from '@/components/PackageForm'
import { categoryLabel } from '@/lib/labels'

export default function PackagesPage() {
  const { data: packages, isLoading } = usePackages()
  const [open, setOpen] = useState(false)

  return (
    <div>
      <PageHeader
        title="الباقات"
        subtitle="باقات الفنادق وشهر العسل والعروض"
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />إضافة باقة</Button>}
      />
      {isLoading ? (
        <PageLoader />
      ) : (packages ?? []).length === 0 ? (
        <EmptyState icon={<PackageIcon className="h-7 w-7" />} title="لا توجد باقات" action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />إضافة باقة</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packages!.map((p) => (
            <Link key={p.id} to={`/packages/${p.id}`} className="card flex flex-col gap-2 p-4 transition hover:border-navy-200 hover:shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-navy-900">{p.package_name}</h3>
                <Badge tone="gold">{categoryLabel[p.package_type ?? ''] ?? p.package_type ?? 'باقة'}</Badge>
              </div>
              {p.region && <div className="inline-flex items-center gap-1 text-xs text-ink-muted"><MapPin className="h-3.5 w-3.5" />{p.region}</div>}
              <div className="mt-1 flex items-center gap-3 border-t border-navy-100 pt-2 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /><span className="nums">{p.hotels_count ?? 0}</span> فندق</span>
                <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /><span className="nums">{p.ready_rates_count ?? 0}</span> سعر جاهز</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <PackageForm open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
