import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, UserCog, ShieldCheck } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { PageHeader, PageLoader, EmptyState } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal, ConfirmDialog } from '@/components/ui/modal'
import { Field, Input, Select, Checkbox } from '@/components/ui/inputs'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/lib/i18n'
import type { Role } from '@/types'

interface UserRow { id: number; email: string; full_name: string; role: Role; is_active: number }

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
                <div className="flex items-center gap-2">
                  <span className="truncate font-bold text-navy-900">{u.full_name}</span>
                  <Badge tone={u.role === 'admin' ? 'gold' : 'navy'}>{t(`role.${u.role}`)}</Badge>
                  {!u.is_active && <Badge tone="red">{t('users.suspended')}</Badge>}
                </div>
                <div className="nums truncate text-xs text-ink-muted" dir="ltr">{u.email}</div>
              </div>
              <button onClick={() => { setEdit(u); setOpen(true) }} className="grid h-9 w-9 place-items-center rounded-btn text-navy-500 hover:bg-navy-50"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => setDel(u)} className="grid h-9 w-9 place-items-center rounded-btn text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
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
  const [f, setF] = useState({
    email: user?.email ?? '',
    full_name: user?.full_name ?? '',
    password: '',
    role: (user?.role ?? 'sales') as Role,
    is_active: user ? user.is_active === 1 : true,
  })
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }))

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = { full_name: f.full_name, role: f.role, is_active: f.is_active }
      if (f.password) payload.password = f.password
      if (editing) return api.put(`/users/${user!.id}`, payload)
      return api.post('/users', { ...payload, email: f.email, password: f.password })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(t('common.saved')); onClose() },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.save')),
  })

  const submit = () => {
    if (!f.full_name.trim()) return toast.error(t('users.nameRequired'))
    if (!editing && (!f.email.trim() || f.password.length < 6)) return toast.error(t('users.credsRequired'))
    save.mutate()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={<span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-navy-600" />{editing ? t('users.editTitle') : t('users.addTitle')}</span>}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={submit} loading={save.isPending}>{t('common.save')}</Button></>}
    >
      <div className="space-y-3">
        <Field label={t('users.fullName')} required><Input value={f.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
        <Field label={t('users.email')} required={!editing}>
          <Input type="email" dir="ltr" value={f.email} onChange={(e) => set('email', e.target.value)} disabled={editing} />
        </Field>
        <Field label={editing ? t('users.newPassword') : t('users.password')} required={!editing}>
          <Input type="password" value={f.password} onChange={(e) => set('password', e.target.value)} placeholder={t('users.passwordHint')} />
        </Field>
        <Field label={t('settings.role')}>
          <Select value={f.role} onChange={(e) => set('role', e.target.value)}>
            {(['admin', 'operations', 'sales', 'viewer'] as Role[]).map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
          </Select>
        </Field>
        <Checkbox checked={f.is_active} onChange={(v) => set('is_active', v)} label={t('users.active')} />
        <p className="rounded-card bg-navy-50 p-2 text-xs text-ink-muted">{t('users.scopeNote')}</p>
      </div>
    </Modal>
  )
}
