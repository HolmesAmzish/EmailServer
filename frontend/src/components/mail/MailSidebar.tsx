import {
  Archive,
  FilePenLine,
  Folder,
  Inbox,
  LogOut,
  Mail,
  MailPlus,
  Pencil,
  Send,
  Star,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuthUser, Mailbox } from '@/types/mail'

interface MailSidebarProps {
  mailboxes: Mailbox[]
  selectedKey: string
  counts: Record<string, number>
  user: AuthUser | null
  mobileOpen: boolean
  onClose: () => void
  onSelect: (key: string) => void
  onCompose: () => void
  onCreateMailbox: () => void
  onEditMailbox: (mailbox: Mailbox) => void
  onDeleteMailbox: (mailbox: Mailbox) => void
  onLogout: () => void
}

interface NavItemProps {
  active: boolean
  count?: number
  icon: LucideIcon
  label: string
  onClick: () => void
}

function NavItem({ active, count, icon: Icon, label, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] leading-none transition-all',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
      <span className={cn('min-w-0 flex-1 truncate text-left', active && 'font-medium')}>
        {label}
      </span>
      {count && count > 0 ? (
        <span
          className={cn(
            'min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none',
            active ? 'bg-primary-foreground/15 text-primary-foreground' : 'bg-muted text-foreground',
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </button>
  )
}

function CustomFolderItem({
  mailbox,
  active,
  count,
  onSelect,
  onEdit,
  onDelete,
}: {
  mailbox: Mailbox
  active: boolean
  count?: number
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'group flex items-center rounded-lg transition-colors',
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-[13px] leading-none"
      >
        <Folder
          size={16}
          strokeWidth={active ? 2.2 : 1.8}
          className={active ? '' : 'text-muted-foreground'}
        />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-left',
            active ? 'font-medium' : 'text-muted-foreground',
          )}
        >
          {mailbox.name}
        </span>
        {count && count > 0 ? (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
              active ? 'bg-primary-foreground/15' : 'bg-muted text-foreground',
            )}
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>
      <div
        className={cn(
          'mr-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
          active && 'text-primary-foreground',
        )}
      >
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            active ? 'hover:bg-primary-foreground/15' : 'text-muted-foreground hover:bg-card hover:text-foreground',
          )}
          title={`Edit ${mailbox.name}`}
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            active
              ? 'hover:bg-primary-foreground/15'
              : 'text-muted-foreground hover:bg-danger/10 hover:text-danger',
          )}
          title={`Delete ${mailbox.name}`}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

export function MailSidebar({
  mailboxes,
  selectedKey,
  counts,
  user,
  mobileOpen,
  onClose,
  onSelect,
  onCompose,
  onCreateMailbox,
  onEditMailbox,
  onDeleteMailbox,
  onLogout,
}: MailSidebarProps) {
  const inbox = mailboxes.find((mailbox) => mailbox.type === 'INBOX')
  const sent = mailboxes.find((mailbox) => mailbox.type === 'SENT')
  const drafts = mailboxes.find((mailbox) => mailbox.type === 'DRAFT')
  const trash = mailboxes.find((mailbox) => mailbox.type === 'TRASH')
  const customMailboxes = mailboxes.filter((mailbox) => mailbox.type === 'CUSTOM')

  const select = (key: string) => {
    onSelect(key)
    onClose()
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close mailbox navigation"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[272px] shrink-0 flex-col border-r border-border bg-card transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-6">
          <button
            type="button"
            onClick={() => select('inbox')}
            className="flex items-center gap-2.5 text-left"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
              <Mail size={14} strokeWidth={2.1} className="text-background" />
            </div>
            <div className="leading-none">
              <div className="text-[13px] font-semibold text-foreground">
                ARORMS<span className="text-primary">.</span>
              </div>
              <div className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                MAIL
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-3 pb-4">
          <button
            type="button"
            onClick={() => {
              onCompose()
              onClose()
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <MailPlus size={15} />
            New message
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-1">
          <div>
            <div className="mb-2 px-3 text-[11px] font-medium text-muted-foreground">
              Favorites
            </div>
            <div className="space-y-1">
              <NavItem
                icon={Inbox}
                label="Inbox"
                active={selectedKey === 'inbox'}
                count={inbox ? counts[String(inbox.id)] : 0}
                onClick={() => select('inbox')}
              />
              <NavItem
                icon={Star}
                label="Starred"
                active={selectedKey === 'starred'}
                onClick={() => select('starred')}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 px-3 text-[11px] font-medium text-muted-foreground">
              Mailboxes
            </div>
            <div className="space-y-1">
              <NavItem
                icon={Send}
                label="Sent"
                active={selectedKey === 'sent'}
                count={sent ? counts[String(sent.id)] : 0}
                onClick={() => select('sent')}
              />
              <NavItem
                icon={FilePenLine}
                label="Drafts"
                active={selectedKey === 'drafts'}
                count={drafts ? counts[String(drafts.id)] : 0}
                onClick={() => select('drafts')}
              />
              <NavItem
                icon={Archive}
                label="Archive"
                active={selectedKey === 'archive'}
                onClick={() => select('archive')}
              />
              <NavItem
                icon={Trash2}
                label="Trash"
                active={selectedKey === 'trash'}
                count={trash ? counts[String(trash.id)] : 0}
                onClick={() => select('trash')}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between px-3">
              <span className="text-[11px] font-medium text-muted-foreground">
                Folders
              </span>
              <button
                type="button"
                onClick={onCreateMailbox}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="New folder"
              >
                <MailPlus size={13} />
              </button>
            </div>
            <div className="space-y-1">
              {customMailboxes.map((mailbox) => (
                <CustomFolderItem
                  key={mailbox.id}
                  mailbox={mailbox}
                  active={selectedKey === `custom-${mailbox.id}`}
                  count={counts[String(mailbox.id)]}
                  onSelect={() => select(`custom-${mailbox.id}`)}
                  onEdit={() => onEditMailbox(mailbox)}
                  onDelete={() => onDeleteMailbox(mailbox)}
                />
              ))}
              {customMailboxes.length === 0 ? (
                <button
                  type="button"
                  onClick={onCreateMailbox}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Folder size={15} />
                  Add folder
                </button>
              ) : null}
            </div>
          </div>
        </nav>

        <div className="space-y-3 border-t border-border/70 p-3">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-medium text-background">
              {(user?.username?.[0] ?? 'M').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium leading-none text-foreground">
                {user?.username ?? 'Account'}
              </div>
              <div className="mt-1 truncate text-[11px] text-muted-foreground">
                {user?.email || 'Signed in with Keycloak'}
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
