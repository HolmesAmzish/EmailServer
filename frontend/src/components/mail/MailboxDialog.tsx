import { useEffect, useState, type FormEvent } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import type { Mailbox, MailboxUpsertInput } from '@/types/mail'

interface MailboxDialogProps {
  open: boolean
  mailbox: Mailbox | null
  saving: boolean
  onClose: () => void
  onSave: (input: MailboxUpsertInput) => void
}

export function MailboxDialog({
  open,
  mailbox,
  saving,
  onClose,
  onSave,
}: MailboxDialogProps) {
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!open) return
    setName(mailbox?.name ?? '')
    setLabel(mailbox?.label ?? '')
  }, [mailbox, open])

  if (!open) return null

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim() || !label.trim() || saving) return
    onSave({
      mailboxName: name.trim(),
      label: label.trim().toLowerCase().replace(/\s+/g, '-'),
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mailbox ? 'Edit folder' : 'New folder'}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">
              {mailbox ? 'Edit folder' : 'New folder'}
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Plus addressing routes messages to this folder.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            aria-label="Close folder dialog"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-[11px] font-medium text-muted-foreground">
              Folder name
            </span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Projects"
              autoFocus
              className="w-full rounded-xl border border-transparent bg-muted px-3 py-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-border focus:bg-card"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-medium text-muted-foreground">
              Address label
            </span>
            <div className="flex items-center rounded-xl border border-transparent bg-muted focus-within:border-border focus-within:bg-card">
              <input
                type="text"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="projects"
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              <span className="shrink-0 pr-3 text-[11px] text-muted-foreground">
                +label@arorms.cn
              </span>
            </div>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-full bg-muted py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/70 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !label.trim() || saving}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-[13px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              {saving ? <LoaderCircle size={14} className="animate-spin" /> : null}
              {mailbox ? 'Save changes' : 'Create folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
