import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, UserCog, ShieldCheck, Settings2, X } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { NAV_ITEMS } from '@/lib/nav'
import { useHotelGroups, useHotels, usePackages } from '@/lib/hooks'
import { PageHeader, PageLoader, EmptyState } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal, ConfirmDialog } from '@/components/ui/modal'
import { Field, Input, Select, Checkbox } from '@/components/ui/inputs'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/lib/i18n'
import { REGIONS } from '@/lib/labels'
import type { AccessRule, Role } from '@/types'

type NavKey = (typeof NAV_ITEMS)[number]['key']

interface UserRow {
  id: number
  email: string
  full_name: string
  role: Role
  is_active: number
  nav_tabs: NavKey[] | null
}

interface UserDetail extends UserRow {
  rules: AccessRule[]
}

const ROLE_ORDER: Role[] = ['admin', 'operations', 'sales', 'viewer']

function roleTabs(role: Role): NavKey[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role)).map((i) => i.key)
}

function defaultRules(role: Role): AccessRule[] {
  const privileged = role === 'admin' || role === 'operations'
  return [{
    scope_type: 'all',
    scope_id: null,
    scope_value: null,
    can_view: true,
    can_edit: privileged,
    can_export: role !== 'viewer',
  }]
}

function emptyRule(): AccessRule {
  return { scope_type: 'all', scope_id: null, scope_value: null, can_view: true, can_edit: false, can_export: false }
}

export default function UsersPage() {
  const { t } = useI18n()
  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.get<UserRow[]>('/users') })
  const [edit, setEdit] = useState<UserRow | null>(null)
  const [open, setOpen] = useState(false)
  const [del, setDel] = useState<UserRow | null>(null)
  const qc = useQueryClient()
  const toast = useToast()

  const remove = useMutation({
    mutationFn: (uid: number) => api.del(`/users/${uid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(t('common.saved')); setDel(null) },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.delete')),
  })

  return (
    <div>
      <PageHeader
        title={t('nav.users')}
        subtitle={t('users.subtitle')}
        actions={<Button size="sm" onClick={() => { setEdit(null); setOpen(true) }}><Plus className="h-4 w-4" />{t('users.add')}</Button>}
      />
      {isLoading ? (
        <PageLoader />
      ) : (users ?? []).length === 0 ? (
        <EmptyState icon={<UserCog className="h-7 w-7" />} title={t('users.empty')} />
      ) : (
        <div className="space-y-2">
          {users!.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-card border border-navy-100 bg-white p-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-100 font-bold text-navy-800">{u.full_name.charAt(0)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-bold text-navy-900">{u.full_name}</span>
                  <Badge tone={u.role === 'admin' ? 'gold' : 'navy'}>{t(`role.${u.role}`)}</Badge>
                  {!u.is_active && <Badge tone="red">{t('users.suspended')}</Badge>}
                  {u.nav_tabs && <Badge tone="slate"><span className="nums">{u.nav_tabs.length}</span> {t('users.tabs')}</Badge>}
                </div>
                <div className="nums truncate text-xs text-ink-muted" dir="ltr">{u.email}</div>
              </div>
              <button onClick={() => { setEdit(u); setOpen(true) }} className="grid h-9 w-9 place-items-center rounded-btn text-navy-500 hover:bg-navy-50" aria-label={t('common.edit')}><Pencil className="h-4 w-4" /></button>
              <button onClick={() => setDel(u)} className="grid h-9 w-9 place-items-center rounded-btn text-red-500 hover:bg-red-50" aria-label={t('common.delete')}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      {open && <UserModal user={edit} onClose={() => setOpen(false)} />}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} danger confirmText={t('common.delete')} loading={remove.isPending} message={t('users.deleteQ', { name: del?.full_name ?? '' })} />
    </div>
  )
}

function UserModal({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const editing = !!user
  const qc = useQueryClient()
  const toast = useToast()
  const { t } = useI18n()
  const { data: groups } = useHotelGroups()
  const { data: hotels } = useHotels()
  const { data: packages } = usePackages()
  const { data: details, isLoading: detailsLoading } = useQuery({
    queryKey: ['user', user?.id],
    queryFn: () => api.get<UserDetail>(`/users/${user!.id}`),
    enabled: editing,
  })
  const [f, setF] = useState({
    email: user?.email ?? '',
    full_name: user?.full_name ?? '',
    password: '',
    role: (user?.role ?? 'sales') as Role,
    is_active: user ? user.is_active === 1 : true,
    nav_tabs: (user?.nav_tabs ?? roleTabs(user?.role ?? 'sales')) as NavKey[],
    rules: defaultRules(user?.role ?? 'sales'),
  })
  const set = (k: keyof typeof f, v: string | boolean | NavKey[] | AccessRule[]) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    if (!editing || !details) return
    setF((p) => ({
      ...p,
      full_name: details.full_name,
      role: details.role,
      is_active: details.is_active === 1,
      nav_tabs: (details.nav_tabs ?? roleTabs(details.role)) as NavKey[],
      rules: details.rules?.length ? details.rules : defaultRules(details.role),
    }))
  }, [details, editing])

  const allowedTabs = useMemo(() => roleTabs(f.role), [f.role])
  const setRole = (role: Role) => {
    const nextTabs = f.nav_tabs.filter((k) => roleTabs(role).includes(k))
    setF((p) => ({ ...p, role, nav_tabs: nextTabs.length ? nextTabs : roleTabs(role), rules: p.rules.length ? p.rules : defaultRules(role) }))
  }
  const toggleTab = (key: NavKey, checked: boolean) => {
    set('nav_tabs', checked ? [...f.nav_tabs, key] : f.nav_tabs.filter((k) => k !== key))
  }

  const updateRule = (idx: number, patch: Partial<AccessRule>) => {
    const rules = f.rules.map((r, i) => {
      if (i !== idx) return r
      const next = { ...r, ...patch }
      if (patch.scope_type) {
        next.scope_id = null
        next.scope_value = null
      }
      return next
    })
    set('rules', rules)
  }

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        full_name: f.full_name,
        role: f.role,
        is_active: f.is_active,
        nav_tabs: f.nav_tabs,
        rules: f.rules,
      }
      if (f.password) payload.password = f.password
      if (editing) return api.put(`/users/${user!.id}`, payload)
      return api.post('/users', { ...payload, email: f.email, password: f.password })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      if (user?.id) qc.invalidateQueries({ queryKey: ['user', user.id] })
      toast.success(t('common.saved'))
      onClose()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.save')),
  })

  const submit = () => {
    if (!f.full_name.trim()) return toast.error(t('users.nameRequired'))
    if (!editing && (!f.email.trim() || f.password.length < 6)) return toast.error(t('users.credsRequired'))
    if (f.nav_tabs.length === 0) return toast.error(t('users.tabsRequired'))
    save.mutate()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={<span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-navy-600" />{editing ? t('users.editTitle') : t('users.addTitle')}</span>}
      size="xl"
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={submit} loading={save.isPending}>{t('common.save')}</Button></>}
    >
      {detailsLoading ? <PageLoader /> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <Field label={t('users.fullName')} required><Input value={f.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
            <Field label={t('users.email')} required={!editing}>
              <Input type="email" dir="ltr" value={f.email} onChange={(e) => set('email', e.target.value)} disabled={editing} />
            </Field>
            <Field label={editing ? t('users.newPassword') : t('users.password')} required={!editing}>
              <Input type="password" value={f.password} onChange={(e) => set('password', e.target.value)} placeholder={t('users.passwordHint')} />
            </Field>
            <Field label={t('settings.role')}>
              <Select value={f.role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLE_ORDER.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
              </Select>
            </Field>
            <Checkbox checked={f.is_active} onChange={(v) => set('is_active', v)} label={t('users.active')} />

            <div className="rounded-card border border-navy-100 bg-navy-50 p-3">
              <div className="mb-2 flex items-center gap-2 font-bold text-navy-900">
                <Settings2 className="h-4 w-4" />{t('users.visibleTabs')}
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {NAV_ITEMS.filter((item) => allowedTabs.includes(item.key)).map((item) => (
                  <Checkbox key={item.key} checked={f.nav_tabs.includes(item.key)} onChange={(v) => toggleTab(item.key, v)} label={t(item.labelKey)} />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-navy-900">{t('users.accessRules')}</h3>
              <Button size="sm" variant="outline" onClick={() => set('rules', [...f.rules, emptyRule()])}><Plus className="h-4 w-4" />{t('users.addRule')}</Button>
            </div>
            <div className="space-y-2">
              {f.rules.map((rule, idx) => (
                <div key={idx} className="rounded-card border border-navy-100 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-navy-900">{t('users.ruleN', { n: idx + 1 })}</span>
                    {f.rules.length > 1 && (
                      <button onClick={() => set('rules', f.rules.filter((_, i) => i !== idx))} className="grid h-8 w-8 place-items-center rounded-btn text-red-500 hover:bg-red-50" aria-label={t('common.delete')}>
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Select value={rule.scope_type} onChange={(e) => updateRule(idx, { scope_type: e.target.value as AccessRule['scope_type'] })}>
                      <option value="all">{t('scope.all')}</option>
                      <option value="region">{t('scope.region')}</option>
                      <option value="hotel_group">{t('scope.hotel_group')}</option>
                      <option value="hotel">{t('scope.hotel')}</option>
                      <option value="package">{t('scope.package')}</option>
                    </Select>
                    {rule.scope_type === 'region' ? (
                      <Select value={rule.scope_value ?? ''} onChange={(e) => updateRule(idx, { scope_value: e.target.value, scope_id: null })}>
                        <option value="">{t('common.select')}</option>
                        {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </Select>
                    ) : rule.scope_type === 'hotel_group' ? (
                      <Select value={rule.scope_id ?? ''} onChange={(e) => updateRule(idx, { scope_id: e.target.value ? Number(e.target.value) : null, scope_value: null })}>
                        <option value="">{t('common.select')}</option>
                        {groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </Select>
                    ) : rule.scope_type === 'hotel' ? (
                      <Select value={rule.scope_id ?? ''} onChange={(e) => updateRule(idx, { scope_id: e.target.value ? Number(e.target.value) : null, scope_value: null })}>
                        <option value="">{t('common.select')}</option>
                        {hotels?.map((h) => <option key={h.id} value={h.id}>{h.hotel_name}</option>)}
                      </Select>
                    ) : rule.scope_type === 'package' ? (
                      <Select value={rule.scope_id ?? ''} onChange={(e) => updateRule(idx, { scope_id: e.target.value ? Number(e.target.value) : null, scope_value: null })}>
                        <option value="">{t('common.select')}</option>
                        {packages?.map((p) => <option key={p.id} value={p.id}>{p.package_name}</option>)}
                      </Select>
                    ) : (
                      <div className="flex min-h-[44px] items-center rounded-btn bg-navy-50 px-3 text-sm text-ink-muted">{t('users.allScopeHint')}</div>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Checkbox checked={!!rule.can_view} onChange={(v) => updateRule(idx, { can_view: v })} label={t('perm.view')} />
                    <Checkbox checked={!!rule.can_edit} onChange={(v) => updateRule(idx, { can_edit: v })} label={t('perm.edit')} />
                    <Checkbox checked={!!rule.can_export} onChange={(v) => updateRule(idx, { can_export: v })} label={t('perm.export')} />
                  </div>
                </div>
              ))}
            </div>
            <p className="rounded-card bg-navy-50 p-2 text-xs text-ink-muted">{t('users.scopeNote')}</p>
          </div>
        </div>
      )}
    </Modal>
  )
}
