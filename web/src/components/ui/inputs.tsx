import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Label({ children, className, htmlFor, required }: { children: ReactNode; className?: string; htmlFor?: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={cn('label-base', className)}>
      {children}
      {required && <span className="text-red-500"> *</span>}
    </label>
  )
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
  className,
}: {
  label?: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('w-full', className)}>
      {label && <Label required={required}>{label}</Label>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn('input-base h-11', className)} {...props} />,
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn('input-base min-h-[88px] resize-y', className)} {...props} />,
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn('input-base h-11 cursor-pointer bg-white', className)} {...props}>
      {children}
    </select>
  ),
)
Select.displayName = 'Select'

export function Checkbox({
  checked,
  onChange,
  label,
  className,
  disabled = false,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <label className={cn('flex min-h-[44px] select-none items-center gap-2.5 text-sm', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer', className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 cursor-pointer rounded border-navy-300 text-navy-700 accent-navy-700 focus:ring-navy-400 disabled:cursor-not-allowed"
      />
      {label && <span className="text-navy-800">{label}</span>}
    </label>
  )
}
