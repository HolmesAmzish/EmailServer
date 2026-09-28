import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Inbox,
  RefreshCw,
  Search,
  Star,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatListDate, initials } from '@/lib/format'
import type { MailSummary, MailViewType } from '@/types/mail'

export type MailSort = 'newest' | 'oldest'

interface MessageListProps {
  mails: MailSummary[]
  mailboxView: MailViewType
  selectedId: number | null
  loading: boolean
  error: boolean
  page: number
  totalPages: number
  total: number
  search: string
  unreadOnly: boolean
  sort: MailSort
  refreshing: boolean
  onSearchChange: (value: string) => void
  onUnreadOnlyChange: (value: boolean) => void
  onSortChange: (value: MailSort) => void
  onSelect: (mail: MailSummary) => void
  onToggleStar: (id: number) => void
  onPageChange: (page: number) => void
  onRefresh: () => void
}

function counterpart(mail: MailSummary, mailboxView: MailViewType) {
  if (mailboxView === 'SENT' || mailboxView === 'DRAFT') {
    return mail.deliveredTo || 'No recipient'
  }
  return mail.fromAddress || 'Unknown sender'
}

function excerpt(value: string | null) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

export function MessageList({
  mails,
  mailboxView,
  selectedId,
  loading,
  error,
  page,
  totalPages,
  total,
  search,
  unreadOnly,
  sort,
  refreshing,
  onSearchChange,
  onUnreadOnlyChange,
  onSortChange,
  onSelect,
  onToggleStar,
  onPageChange,
  onRefresh,
}: MessageListProps) {
  return (
    <section className="flex h-full min-h-0 w-full min-w-0 flex-col border-r border-border bg-card">
      <div className="shrink-0 border-b border-border px-3 py-3">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search messages"
            className="h-9 w-full rounded-xl border border-transparent bg-muted pl-9 pr-9 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-border focus:bg-card"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onUnreadOnlyChange(!unreadOnly)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              unreadOnly
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            Unread
          </button>
          <button
            type="button"
            onClick={() => onSortChange(sort === 'newest' ? 'oldest' : 'newest')}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            title="Change sort order"
          >
            <ArrowDownUp size={12} />
            {sort === 'newest' ? 'Newest' : 'Oldest'}
          </button>
          <span className="min-w-0 flex-1 truncate text-right text-[11px] text-muted-foreground">
            {total} {total === 1 ? 'message' : 'messages'}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Refresh messages"
          >
            <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-px">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="border-b border-border px-4 py-4">
                <div className="flex gap-3">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/5 animate-pulse rounded-full bg-muted" />
                    <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
                    <div className="h-3 w-3/5 animate-pulse rounded-full bg-muted" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <p className="text-[13px] text-danger">Messages could not be loaded.</p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-3 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted"
            >
              Try again
            </button>
          </div>
        ) : mails.length === 0 ? (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
              <Inbox size={22} strokeWidth={1.6} />
            </div>
            <p className="mt-4 text-[13px] font-medium text-foreground">No messages here</p>
            <p className="mt-1 max-w-[220px] text-[12px] text-muted-foreground">
              {search || unreadOnly
                ? 'Try changing the current search or filter.'
                : 'This mailbox is up to date.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {mails.map((mail) => {
              const selected = mail.id === selectedId
              const starred = mail.isStarred
              const sender = counterpart(mail, mailboxView)
              const preview = excerpt(mail.textContent)
              const messageDate = mail.receivedAt ?? mail.sentAt

              return (
                <div
                  key={mail.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(mail)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelect(mail)
                    }
                  }}
                  className={cn(
                    'group relative cursor-pointer border-l-2 px-3 py-3.5 transition-colors',
                    selected
                      ? 'border-l-primary bg-primary/[0.055]'
                      : 'border-l-transparent hover:bg-muted/75',
                  )}
                >
                  <div className="flex gap-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                        selected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground',
                      )}
                    >
                      {initials(sender)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {!mail.seen ? (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            ) : null}
                            <span
                              className={cn(
                                'truncate text-[13px] text-foreground',
                                !mail.seen && 'font-semibold',
                              )}
                            >
                              {sender}
                            </span>
                          </div>
                          <p
                            className={cn(
                              'mt-1 truncate text-[13px] text-foreground',
                              !mail.seen && 'font-medium',
                            )}
                          >
                            {mail.subject || '(No subject)'}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[12px] leading-4 text-muted-foreground">
                            {preview || 'No message preview'}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="text-[10px] text-muted-foreground">
                            {formatListDate(messageDate)}
                          </span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onToggleStar(mail.id)
                            }}
                            className={cn(
                              'rounded-md p-1 transition-colors',
                              starred
                                ? 'text-warning'
                                : 'text-muted-foreground opacity-0 hover:bg-card hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100',
                            )}
                            title={starred ? 'Remove star' : 'Star message'}
                            aria-label={starred ? 'Remove star' : 'Star message'}
                          >
                            <Star size={14} fill={starred ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex shrink-0 items-center justify-between border-t border-border bg-muted/60 px-3 py-2.5">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft size={12} />
            Prev
          </button>
          <span className="text-[11px] text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-40"
          >
            Next
            <ChevronRight size={12} />
          </button>
        </div>
      ) : null}
    </section>
  )
}
