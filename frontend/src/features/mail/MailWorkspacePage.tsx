import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import {
  Inbox,
  Menu,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
} from 'lucide-react'
import {
  createDraft,
  createMailbox,
  deleteMail,
  deleteMailbox,
  downloadAttachment,
  fetchMailboxMails,
  markMailRead,
  sendMail,
  updateDraft,
  updateMailbox,
} from '@/api/mail'
import { logout } from '@/api/auth'
import { MessageList, type MailSort } from '@/components/mail/MessageList'
import { MessageReader } from '@/components/mail/MessageReader'
import { MailSidebar } from '@/components/mail/MailSidebar'
import {
  ComposeDialog,
  type ComposeSession,
} from '@/components/mail/ComposeDialog'
import { MailboxDialog } from '@/components/mail/MailboxDialog'
import { useAuth } from '@/hooks/useAuth'
import { useMailboxes, MAILBOXES_QUERY_KEY } from '@/hooks/useMailboxes'
import {
  MAIL_DETAIL_QUERY_KEY,
  MAILS_QUERY_KEY,
  useAllMails,
  useMailboxMails,
} from '@/hooks/useMails'
import { useMailDetail } from '@/hooks/useMailDetail'
import { useTheme, type Theme } from '@/context/ThemeContext'
import { useToast } from '@/context/ToastContext'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/format'
import type {
  Attachment,
  Mailbox,
  MailboxType,
  MailboxUpsertInput,
  MailComposeInput,
  MailSummary,
} from '@/types/mail'

const SYSTEM_MAILBOXES: { key: string; type: MailboxType; label: string }[] = [
  { key: 'inbox', type: 'INBOX', label: 'Inbox' },
  { key: 'sent', type: 'SENT', label: 'Sent' },
  { key: 'drafts', type: 'DRAFT', label: 'Drafts' },
  { key: 'trash', type: 'TRASH', label: 'Trash' },
]

function resolveMailbox(key: string, mailboxes: Mailbox[]) {
  const system = SYSTEM_MAILBOXES.find((item) => item.key === key)
  if (system) return mailboxes.find((mailbox) => mailbox.type === system.type) ?? null
  if (key.startsWith('custom-')) {
    const id = Number(key.slice('custom-'.length))
    return mailboxes.find((mailbox) => mailbox.id === id && mailbox.type === 'CUSTOM') ?? null
  }
  return null
}

function resolveMailboxType(key: string, mailbox: Mailbox | null): MailboxType | 'STARRED' | 'ARCHIVE' {
  if (key === 'starred') return 'STARRED'
  if (key === 'archive') return 'ARCHIVE'
  return mailbox?.type ?? 'INBOX'
}

function isKnownMailboxKey(key: string, mailboxes: Mailbox[]) {
  if (['inbox', 'sent', 'drafts', 'trash', 'starred', 'archive'].includes(key)) return true
  if (key.startsWith('custom-')) {
    const id = Number(key.slice('custom-'.length))
    return Number.isFinite(id) && mailboxes.some((mailbox) => mailbox.id === id)
  }
  return false
}

function folderTitle(key: string, mailbox: Mailbox | null) {
  if (key === 'starred') return 'Starred'
  if (key === 'archive') return 'Archive'
  if (mailbox) return mailbox.name
  return SYSTEM_MAILBOXES.find((item) => item.key === key)?.label ?? 'Mailbox'
}

function sortMails(mails: MailSummary[], sort: MailSort) {
  return [...mails].sort((a, b) => {
    const left = new Date(a.receivedAt ?? a.sentAt ?? 0).getTime()
    const right = new Date(b.receivedAt ?? b.sentAt ?? 0).getTime()
    return sort === 'newest' ? right - left : left - right
  })
}

function matchesSearch(mail: MailSummary, search: string) {
  if (!search) return true
  const haystack = [
    mail.subject,
    mail.fromAddress,
    mail.replyTo,
    mail.deliveredTo,
    mail.textContent,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(search)
}

function replyContent(mail: {
  textContent: string | null
  fromAddress: string | null
  receivedAt: string | null
  sentAt: string | null
}) {
  const original = (mail.textContent ?? '').trim()
  if (!original) return ''
  const date = mail.receivedAt ?? mail.sentAt
  const header = `On ${date ? new Date(date).toLocaleString() : 'an earlier date'}, ${mail.fromAddress ?? 'the sender'} wrote:`
  const quoted = original
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
  return `\n\n${header}\n${quoted}`
}

function HeaderThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const options: { value: Theme; label: string; icon: typeof Monitor }[] = [
    { value: 'system', label: 'System theme', icon: Monitor },
    { value: 'light', label: 'Light theme', icon: Sun },
    { value: 'dark', label: 'Dark theme', icon: Moon },
  ]

  return (
    <div className="flex items-center rounded-full border border-border bg-muted p-0.5">
      {options.map((option) => {
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            className={cn(
              'rounded-full p-1.5 transition-colors',
              theme === option.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title={option.label}
            aria-label={option.label}
          >
            <Icon size={13} />
          </button>
        )
      })}
    </div>
  )
}

export function MailWorkspacePage() {
  const { mailboxKey = 'inbox', mailId: mailIdParam } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { resolved, setTheme } = useTheme()
  const { pushToast } = useToast()
  const { user } = useAuth()

  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [sort, setSort] = useState<MailSort>('newest')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [composeSession, setComposeSession] = useState<ComposeSession | null>(null)
  const [mailboxDialogOpen, setMailboxDialogOpen] = useState(false)
  const [editingMailbox, setEditingMailbox] = useState<Mailbox | null>(null)
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set())
  const [archivedIds, setArchivedIds] = useState<Set<number>>(new Set())

  const mailId = mailIdParam && /^\d+$/.test(mailIdParam) ? Number(mailIdParam) : null
  const mailboxesQuery = useMailboxes()
  const mailboxes = mailboxesQuery.data ?? []
  const selectedMailbox = useMemo(
    () => resolveMailbox(mailboxKey, mailboxes),
    [mailboxKey, mailboxes],
  )
  const mailboxType = resolveMailboxType(mailboxKey, selectedMailbox)
  const starred = mailId !== null && starredIds.has(mailId)
  const archived = mailId !== null && archivedIds.has(mailId)

  const normalMailsQuery = useMailboxMails(
    selectedMailbox?.id ?? null,
    page,
    30,
    mailboxKey !== 'starred' && mailboxKey !== 'archive',
  )
  const allMailsQuery = useAllMails(
    0,
    100,
    mailboxKey === 'starred' || mailboxKey === 'archive',
  )
  const detailQuery = useMailDetail(mailId)
  const detail = detailQuery.data

  const systemMailboxes = SYSTEM_MAILBOXES
    .map((item) => mailboxes.find((mailbox) => mailbox.type === item.type))
    .filter((mailbox): mailbox is Mailbox => Boolean(mailbox))

  const countQueries = useQueries({
    queries: systemMailboxes.map((mailbox) => ({
      queryKey: [...MAILS_QUERY_KEY, mailbox.id, 0, 100] as const,
      queryFn: () => fetchMailboxMails(mailbox.id, 0, 100),
      enabled: mailboxesQuery.isSuccess,
      staleTime: 60_000,
    })),
  })

  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    systemMailboxes.forEach((mailbox, index) => {
      const data = countQueries[index]?.data
      counts[String(mailbox.id)] =
        data?.content.filter((mail) => !mail.seen && !archivedIds.has(mail.id)).length ?? 0
    })
    return counts
  }, [archivedIds, countQueries, systemMailboxes])

  const sourceMails = useMemo(() => {
    if (mailboxKey === 'starred') {
      return allMailsQuery.data?.content.filter((mail) => starredIds.has(mail.id)) ?? []
    }
    if (mailboxKey === 'archive') {
      return allMailsQuery.data?.content.filter((mail) => archivedIds.has(mail.id)) ?? []
    }
    return (normalMailsQuery.data?.content ?? []).filter(
      (mail) => !archivedIds.has(mail.id),
    )
  }, [
    allMailsQuery.data?.content,
    archivedIds,
    mailboxKey,
    normalMailsQuery.data?.content,
    starredIds,
  ])

  const visibleMails = useMemo(
    () =>
      sortMails(
        sourceMails.filter(
          (mail) =>
            matchesSearch(mail, deferredSearch) && (!unreadOnly || !mail.seen),
        ),
        sort,
      ),
    [deferredSearch, sort, sourceMails, unreadOnly],
  )

  const total = useMemo(() => {
    if (
      mailboxKey === 'starred' ||
      mailboxKey === 'archive' ||
      deferredSearch ||
      unreadOnly ||
      archivedIds.size > 0
    ) {
      return visibleMails.length
    }
    return normalMailsQuery.data?.total ?? 0
  }, [
    archivedIds.size,
    deferredSearch,
    mailboxKey,
    normalMailsQuery.data?.total,
    unreadOnly,
    visibleMails.length,
  ])

  const totalPages =
    mailboxKey === 'starred' || mailboxKey === 'archive'
      ? 1
      : normalMailsQuery.data?.totalPages ?? 1

  useEffect(() => {
    setPage(0)
    setSearch('')
    setUnreadOnly(false)
  }, [mailboxKey])

  useEffect(() => {
    if (!mailboxesQuery.isSuccess) return
    if (!isKnownMailboxKey(mailboxKey, mailboxes)) {
      navigate('/mail/inbox', { replace: true })
    }
  }, [mailboxKey, mailboxes, mailboxesQuery.isSuccess, navigate])

  const starStorageKey = `email-stars:${user?.id ?? 'current-user'}`
  const archiveStorageKey = `email-archive:${user?.id ?? 'current-user'}`

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(starStorageKey) ?? '[]') as unknown
      setStarredIds(
        new Set(Array.isArray(saved) ? saved.filter((id): id is number => typeof id === 'number') : []),
      )
    } catch {
      setStarredIds(new Set())
    }
  }, [starStorageKey])

  const saveStars = (next: Set<number>) => {
    setStarredIds(next)
    localStorage.setItem(starStorageKey, JSON.stringify([...next]))
  }

  const toggleStar = (id: number) => {
    const next = new Set(starredIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    saveStars(next)
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(archiveStorageKey) ?? '[]') as unknown
      setArchivedIds(
        new Set(
          Array.isArray(saved)
            ? saved.filter((id): id is number => typeof id === 'number')
            : [],
        ),
      )
    } catch {
      setArchivedIds(new Set())
    }
  }, [archiveStorageKey])

  const toggleArchive = (id: number) => {
    const next = new Set(archivedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setArchivedIds(next)
    localStorage.setItem(archiveStorageKey, JSON.stringify([...next]))
    navigate(`/mail/${mailboxKey}`)
    pushToast({
      message: next.has(id) ? 'Message archived.' : 'Message restored.',
      tone: 'success',
    })
  }

  const invalidateMailData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: MAILS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: MAIL_DETAIL_QUERY_KEY }),
    ])
  }

  const markReadMutation = useMutation({
    mutationFn: markMailRead,
    onSuccess: invalidateMailData,
  })

  const readSyncedId = useRef<number | null>(null)
  useEffect(() => {
    if (!detail || detail.seen || readSyncedId.current === detail.id) return
    readSyncedId.current = detail.id
    markReadMutation.mutate(detail.id)
  }, [detail, markReadMutation])

  const deleteMutation = useMutation({
    mutationFn: deleteMail,
    onSuccess: async (_, id) => {
      await invalidateMailData()
      if (id === mailId) navigate(`/mail/${mailboxKey}`, { replace: true })
      pushToast({ message: 'Message moved to trash.', tone: 'success' })
    },
    onError: (error) => {
      pushToast({ message: getApiErrorMessage(error), tone: 'danger' })
    },
  })

  const saveDraftMutation = useMutation({
    mutationFn: ({
      session,
      input,
    }: {
      session: ComposeSession
      input: MailComposeInput
    }) =>
      session.draftId
        ? updateDraft(session.draftId, input)
        : createDraft(input),
    onSuccess: async () => {
      await invalidateMailData()
      setComposeSession(null)
      pushToast({ message: 'Draft saved.', tone: 'success' })
    },
    onError: (error) => {
      pushToast({ message: getApiErrorMessage(error), tone: 'danger' })
    },
  })

  const sendMutation = useMutation({
    mutationFn: sendMail,
    onSuccess: async () => {
      await invalidateMailData()
      setComposeSession(null)
      pushToast({ message: 'Message sent.', tone: 'success' })
    },
    onError: (error) => {
      pushToast({ message: getApiErrorMessage(error), tone: 'danger' })
    },
  })

  const mailboxMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id?: number
      input: MailboxUpsertInput
    }) => (id ? updateMailbox(id, input) : createMailbox(input)),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: MAILBOXES_QUERY_KEY })
      setMailboxDialogOpen(false)
      setEditingMailbox(null)
      pushToast({
        message: variables.id ? 'Folder updated.' : 'Folder created.',
        tone: 'success',
      })
    },
    onError: (error) => {
      pushToast({ message: getApiErrorMessage(error), tone: 'danger' })
    },
  })

  const deleteMailboxMutation = useMutation({
    mutationFn: deleteMailbox,
    onSuccess: async (_, id) => {
      await queryClient.invalidateQueries({ queryKey: MAILBOXES_QUERY_KEY })
      if (mailboxKey === `custom-${id}`) navigate('/mail/inbox', { replace: true })
      pushToast({ message: 'Folder deleted.', tone: 'success' })
    },
    onError: (error) => {
      pushToast({ message: getApiErrorMessage(error), tone: 'danger' })
    },
  })

  const selectMailbox = (key: string) => {
    navigate(`/mail/${key}`)
  }

  const selectMail = (mail: MailSummary) => {
    navigate(`/mail/${mailboxKey}/${mail.id}`)
  }

  const openReply = () => {
    if (!detail) return
    const subject = detail.subject?.toLowerCase().startsWith('re:')
      ? detail.subject
      : `Re: ${detail.subject || '(No subject)'}`
    setComposeSession({
      mode: 'reply',
      initial: {
        to: detail.replyTo || detail.fromAddress || '',
        subject,
        content: replyContent(detail),
      },
    })
  }

  const openDraft = () => {
    if (!detail) return
    setComposeSession({
      mode: 'draft',
      draftId: detail.id,
      initial: {
        to: detail.deliveredTo || '',
        subject: detail.subject || '',
        content: detail.textContent || '',
      },
    })
  }

  const handleDelete = () => {
    if (!detail) return
    const message =
      mailboxType === 'TRASH'
        ? 'Delete this message permanently?'
        : 'Move this message to trash?'
    if (window.confirm(message)) deleteMutation.mutate(detail.id)
  }

  const handleDownload = async (attachment: Attachment) => {
    try {
      const blob = await downloadAttachment(attachment.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.filename || `attachment-${attachment.id}`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      pushToast({
        message: 'Attachment storage is not connected yet.',
        tone: 'danger',
      })
    }
  }

  const refreshCurrent = () => {
    if (mailboxKey === 'starred' || mailboxKey === 'archive') {
      void allMailsQuery.refetch()
    } else {
      void normalMailsQuery.refetch()
    }
  }

  const usesAggregateList = mailboxKey === 'starred' || mailboxKey === 'archive'
  const listLoading =
    mailboxesQuery.isLoading ||
    (usesAggregateList ? allMailsQuery.isLoading : normalMailsQuery.isLoading)
  const listError =
    mailboxesQuery.isError ||
    (usesAggregateList ? allMailsQuery.isError : normalMailsQuery.isError)

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <MailSidebar
        mailboxes={mailboxes}
        selectedKey={mailboxKey}
        counts={unreadCounts}
        user={user}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onSelect={selectMailbox}
        onCompose={() =>
          setComposeSession({
            mode: 'new',
            initial: { to: '', subject: '', content: '' },
          })
        }
        onCreateMailbox={() => {
          setEditingMailbox(null)
          setMailboxDialogOpen(true)
        }}
        onEditMailbox={(mailbox) => {
          setEditingMailbox(mailbox)
          setMailboxDialogOpen(true)
        }}
        onDeleteMailbox={(mailbox) => {
          if (window.confirm(`Delete the folder "${mailbox.name}" and its messages?`)) {
            deleteMailboxMutation.mutate(mailbox.id)
          }
        }}
        onLogout={() => void logout()}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur-xl lg:px-4">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card hover:text-foreground lg:hidden"
            aria-label="Open mailbox navigation"
          >
            <Menu size={17} />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Inbox size={15} className="shrink-0 text-muted-foreground" />
            <h1 className="truncate text-[13px] font-semibold text-foreground">
              {folderTitle(mailboxKey, selectedMailbox)}
            </h1>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              {total} {total === 1 ? 'message' : 'messages'}
            </span>
          </div>

          <button
            type="button"
            onClick={refreshCurrent}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            title="Refresh"
            aria-label="Refresh messages"
          >
            <RefreshCw
              size={14}
              className={cn(
                (normalMailsQuery.isFetching || allMailsQuery.isFetching) && 'animate-spin',
              )}
            />
          </button>
          <button
            type="button"
            onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card hover:text-foreground lg:hidden"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {resolved === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <div className="hidden lg:block">
            <HeaderThemeSwitcher />
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
          <div
            className={cn(
              'h-full min-h-0 min-w-0 overflow-hidden',
              mailId !== null ? 'hidden md:flex' : 'flex',
            )}
          >
            <MessageList
              mails={visibleMails}
              mailboxType={mailboxType}
              selectedId={mailId}
              loading={listLoading}
              error={listError}
              page={page}
              totalPages={totalPages}
              total={total}
              search={search}
              unreadOnly={unreadOnly}
              sort={sort}
              starredIds={starredIds}
              refreshing={normalMailsQuery.isFetching || allMailsQuery.isFetching}
              onSearchChange={setSearch}
              onUnreadOnlyChange={setUnreadOnly}
              onSortChange={setSort}
              onSelect={selectMail}
              onToggleStar={toggleStar}
              onPageChange={setPage}
              onRefresh={refreshCurrent}
            />
          </div>

          <div
            className={cn(
              'h-full min-h-0 min-w-0 overflow-hidden',
              mailId !== null ? 'flex' : 'hidden md:flex',
            )}
          >
            <MessageReader
              mail={detail}
              mailboxType={mailboxType}
              loading={detailQuery.isLoading}
              error={detailQuery.isError}
              starred={starred}
              archived={archived}
              onBack={() => navigate(`/mail/${mailboxKey}`)}
              onToggleStar={() => {
                if (mailId !== null) toggleStar(mailId)
              }}
              onToggleArchive={() => {
                if (mailId !== null) toggleArchive(mailId)
              }}
              onReply={openReply}
              onEditDraft={openDraft}
              onDelete={handleDelete}
              onDownloadAttachment={(attachment) => void handleDownload(attachment)}
            />
          </div>
        </main>
      </div>

      <ComposeDialog
        session={composeSession}
        saving={saveDraftMutation.isPending}
        sending={sendMutation.isPending}
        onClose={() => setComposeSession(null)}
        onSaveDraft={(input) => {
          if (composeSession) saveDraftMutation.mutate({ session: composeSession, input })
        }}
        onSend={(input) => sendMutation.mutate(input)}
      />

      <MailboxDialog
        open={mailboxDialogOpen}
        mailbox={editingMailbox}
        saving={mailboxMutation.isPending}
        onClose={() => {
          setMailboxDialogOpen(false)
          setEditingMailbox(null)
        }}
        onSave={(input) =>
          mailboxMutation.mutate({ id: editingMailbox?.id, input })
        }
      />
    </div>
  )
}
