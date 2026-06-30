import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogIn } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { homeForRole } from '@/lib/nav'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/inputs'
import { Logo } from '@/components/layout/Logo'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/lib/i18n'
import { ApiError } from '@/lib/api'
import type { Role } from '@/types'

const demo: { role: Role; email: string; password: string }[] = [
  { role: 'admin', email: 'admin@elbakri.com', password: 'Admin@123' },
  { role: 'operations', email: 'ops@elbakri.com', password: 'Ops@123' },
  { role: 'sales', email: 'sales@elbakri.com', password: 'Sales@123' },
  { role: 'viewer', email: 'viewer@elbakri.com', password: 'Viewer@123' },
]

export default function LoginPage() {
  const { login, user } = useAuth()
  const { t, dir } = useI18n()
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('auth.badEmail')),
        password: z.string().min(1, t('auth.needPassword')),
      }),
    [t],
  )
  type Form = z.infer<typeof schema>
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (user) navigate(homeForRole(user.role), { replace: true })
  }, [user, navigate])

  const onSubmit = async (data: Form) => {
    setSubmitting(true)
    try {
      await login(data.email, data.password)
      toast.success(t('auth.success'))
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t('auth.fail'))
    } finally {
      setSubmitting(false)
    }
  }

  const features = [t('nav.hotels'), t('nav.packages'), t('nav.matrix'), 'PNG / PDF', 'WhatsApp']

  return (
    <div className="grid min-h-screen lg:grid-cols-2" dir={dir}>
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-10 text-white lg:flex">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-navy-700/40 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-gold/10 blur-3xl" />
        <Logo variant="light" />
        <div className="relative z-10 max-w-md">
          <h1 className="text-3xl font-extrabold leading-snug">{t('auth.heroTitle')}</h1>
          <p className="mt-3 text-navy-200">{t('auth.heroBody')}</p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            {features.map((f) => (
              <span key={f} className="rounded-full border border-white/15 bg-white/5 px-3 py-1">{f}</span>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-xs text-navy-300">© {new Date().getFullYear()} ELBAKRI OVERSEAS FOR TRAVEL</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-surface px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-4 flex items-center justify-between lg:justify-end">
            <div className="lg:hidden">
              <Logo />
            </div>
            <LanguageToggle />
          </div>
          <div className="card p-6">
            <h2 className="text-xl font-extrabold text-navy-900">{t('auth.title')}</h2>
            <p className="mb-5 mt-1 text-sm text-ink-muted">{t('auth.subtitle')}</p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Field label={t('auth.email')} required error={errors.email?.message}>
                <Input type="email" dir="ltr" placeholder="you@elbakri.com" {...register('email')} />
              </Field>
              <Field label={t('auth.password')} required error={errors.password?.message}>
                <Input type="password" dir="ltr" placeholder="••••••••" {...register('password')} />
              </Field>
              <Button type="submit" size="lg" loading={submitting} className="w-full">
                <LogIn className="h-5 w-5" />
                {t('auth.signin')}
              </Button>
            </form>
          </div>

          <div className="mt-4 rounded-card border border-navy-100 bg-white/60 p-3">
            <p className="mb-2 text-center text-xs font-semibold text-ink-muted">{t('auth.demoTitle')}</p>
            <div className="grid grid-cols-2 gap-2">
              {demo.map((d) => (
                <button
                  key={d.email}
                  onClick={() => { setValue('email', d.email); setValue('password', d.password) }}
                  className="rounded-btn border border-navy-100 bg-white px-2 py-2 text-xs font-semibold text-navy-700 hover:bg-navy-50"
                >
                  {t(`role.${d.role}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
