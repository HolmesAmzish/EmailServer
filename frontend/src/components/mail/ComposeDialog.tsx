import { useEffect, useState, type FormEvent } from 'react'
import { LoaderCircle, Send, X } from 'lucide-react'
import type { MailComposeInput } from '@/types/mail'

export interface ComposeSession {
  mode: 'new' | 'reply' | 'draft'
  draftId?: number
  initial: MailComposeInput
}

interface ComposeDialogProps {
  session: ComposeSession | null
  saving: boolean
  sending: boolean
  onClose: () => void
  onSaveDraft: (input: MailComposeInput) => void
  onSend: (input: MailComposeInput) => void
}

export function ComposeDialog({
  session,
  saving,
  sending,
  onClose,
  onSaveDraft,
  onSend,
}: ComposeDialogProps) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => {
    if (!session) return
    setTo(session.initial.to)
    setSubject(session.initial.subject)
    setContent(session.initial.content)
  }, [session])

  if (!session) return null

  const busy = saving || sending
  const title =
    session.mode === 'draft'
      ? 'Edit draft'
      : session.mode === 'reply'
        ? 'Reply'
        : 'New message'

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!to.trim() || busy) return
    onSend({ to: to.trim(), subject: subject.trim(), content })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-[100dvh] w-full flex-col overflow-hidden border-border bg-card shadow-xl sm:h-[min(760px,calc(100vh-2rem))] sm:max-w-3xl sm:rounded-2xl sm:border"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            aria-label="Close composer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-border px-4 lg:px-5">
            <label className="flex items-center gap-3 border-b border-border py-2">
              <span className="w-12 shrink-0 text-[11px] font-medium text-muted-foreground">
                To
              </span>
              <input
                type="email"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="name@example.com"
                autoFocus
                className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <label className="flex items-center gap-3 py-2">
              <span className="w-12 shrink-0 text-[11px] font-medium text-muted-foreground">
                Subject
              </span>
              <input
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Subject"
                className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[13px] font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
              />
            </label>
          </div>

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write a message..."
            className="min-h-0 flex-1 resize-none border-0 bg-card px-4 py-5 text-[13px] leading-6 text-foreground outline-none placeholder:text-muted-foreground lg:px-5"
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && to.trim() && !busy) {
                onSend({ to: to.trim(), subject: subject.trim(), content })
              }
            }}
          />

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-3 lg:px-5">
            <button
              type="button"
              onClick={() => onSaveDraft({ to: to.trim(), subject: subject.trim(), content })}
              disabled={busy}
              className="rounded-full bg-muted px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/70 disabled:opacity-40"
            >
              {session.mode === 'draft' ? 'Save draft' : 'Save as draft'}
            </button>
            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} Enter
              </span>
              <button
                type="submit"
                disabled={!to.trim() || busy}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
                Send
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
