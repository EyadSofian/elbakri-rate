import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Shield, Activity, LogOut, Building2, Info } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/lib/i18n'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useI18n()
  const isOps = user && ['admin', 'operations'].includes(user.role)

  return (
    <div>
      <PageHeader title={t('nav.settings')} subtitle={t('settings.subtitle')} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-bold text-navy-900"><User className="h-5 w-5 text-navy-500" />{t('settings.account')}</h3>
          <div className="space-y-2 text-sm">
            <Row label={t('settings.name')} value={user?.full_name} />
            <Row label={t('settings.email')} value={<span dir="ltr" className="nums">{user?.email}</span>} />
            <Row label={t('settings.role')} value={<Badge tone="navy">{user ? t(`role.${user.role}`) : ''}</Badge>} />
            <Row label={t('settings.canEdit')} value={<Badge tone={user?.can_edit ? 'green' : 'slate'}>{user?.can_edit ? t('settings.yes') : t('settings.no')}</Badge>} />
            <Row label={t('settings.canExport')} value={<Badge tone={user?.can_export ? 'green' : 'slate'}>{user?.can_export ? t('settings.yes') : t('settings.no')}</Badge>} />
          </div>
          <Button variant="danger" className="mt-4 w-full" onClick={async () => { await logout(); navigate('/auth') }}>
            <LogOut className="h-4 w-4" />{t('settings.logout')}
          </Button>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-bold text-navy-900"><Building2 className="h-5 w-5 text-navy-500" />{t('settings.about')}</h3>
          <div className="space-y-2 text-sm">
            <Row label={t('settings.app')} value="ELBAKRI Hotel Rate Hub" />
            <Row label={t('settings.company')} value="ELBAKRI OVERSEAS FOR TRAVEL" />
            <Row label={t('settings.version')} value={<span className="nums">1.0.0</span>} />
            <Row label={t('settings.database')} value="MySQL · PHP 8 API" />
          </div>
          <div className="mt-4 space-y-2">
            {isOps && (
              <Link to="/system-check"><Button variant="outline" className="w-full"><Activity className="h-4 w-4" />{t('nav.system')}</Button></Link>
            )}
            {user?.role === 'admin' && (
              <Link to="/users"><Button variant="outline" className="w-full"><Shield className="h-4 w-4" />{t('settings.manageUsers')}</Button></Link>
            )}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-card bg-navy-50 p-3 text-xs text-ink-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {t('settings.bilingualNote')}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-navy-50 py-1.5 last:border-0">
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold text-navy-900">{value}</span>
    </div>
  )
}
