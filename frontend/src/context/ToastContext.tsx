import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'danger' | 'info'

interface ToastInput {
  message: string
  tone?: ToastTone
}

interface ToastItem extends ToastInput {
  id: number
}

interface ToastContextValue {
  pushToast: (toast: ToastInput) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback(
    ({ message, tone = 'info' }: ToastInput) => {
      const id = Date.now() + Math.random()
      setToasts((current) => [...current, { id, message, tone }])
      window.setTimeout(() => removeToast(id), 4200)
    },
    [removeToast],
  )

  const value = useMemo(() => ({ pushToast }), [pushToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => {
          const Icon =
            toast.tone === 'success'
              ? CheckCircle2
              : toast.tone === 'danger'
                ? TriangleAlert
                : Info
          return (
            <div
              key={toast.id}
              className={cn(
                'animate-fade-in flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-[13px] shadow-[0_4px_16px_rgba(0,0,0,0.08)]',
                toast.tone === 'success' && 'border-success/25',
                toast.tone === 'danger' && 'border-danger/25',
                toast.tone === 'info' && 'border-border',
              )}
              role="status"
            >
              <Icon
                size={16}
                className={cn(
                  'mt-0.5 shrink-0',
                  toast.tone === 'success' && 'text-success',
                  toast.tone === 'danger' && 'text-danger',
                  toast.tone === 'info' && 'text-primary',
                )}
              />
              <p className="min-w-0 flex-1 text-foreground">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
