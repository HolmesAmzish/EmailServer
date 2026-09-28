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
  deleteMailbox,
  downloadAttachment,
  fetchMailboxMails,
  moveMail,
  permanentlyDeleteMail,
  sendMail,
  setMailArchived,
  setMailDeleted,
  setMailRead,
  setMailStarred,
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
  useDeletedMails,
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
  MailViewType,
} from '@/types/mail'

const SYSTEM_MAILBOXES: { key: string; type: MailboxType; label: string }[] = [
  { key: 'inbox', type: 'INBOX', label: 'Inbox' },
  { key: 'sent', type: 'SENT', label: 'Sent' },
  { key: 'drafts', type: 'DRAFT', label: 'Drafts' },
  { key: 'trash', type: 'TRASH', label: 'Trash' },
  { key: 'archive', type: 'ARCHIVE', label: 'Archive' },
]

function resolveMailbox(key: string, mailboxes: Mailbox[]) {
  const system = SYSTEM_MAILBOXES.find((item) => item.key === key)
  if (system) return mailboxes.find((mailbox) => mailbox.type === system.type) ?? null
  if (key.startsWith('custom-')) {
    const id = Number(key.slice('custom-'.length))
    return mailboxes.find((mailbox) => mailbox.id === id && mailbox.type === 'ARCHIVE') ?? null
  }
  return null
}

function resolveMailboxView(key: string, mailbox: Mailbox | null): MailViewType {
  if (key === 'starred') return 'STARRED'
  if (key === 'deleted') return 'DELETED'
  if (key === 'archive') return 'ARCHIVE'
  return mailbox?.type ?? 'INBOX'
}

function isKnownMailboxKey(key: string, mailboxes: Mailbox[]) {
  if (['inbox', 'sent', 'drafts', 'trash', 'starred', 'archive', 'deleted'].includes(key)) return true
  if (key.startsWith('custom-')) {
    const id = Number(key.slice('custom-'.length))
    return Number.isFinite(id) && mailboxes.some((mailbox) => mailbox.id === id)
  }
  return false
}

function folderTitle(key: string, mailbox: Mailbox | null) {
  if (key === 'starred') return 'Starred'
  if (key === 'archive') return 'Archive'
  if (key === 'deleted') return 'Deleted'
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
  const mailId = mailIdParam && /^\d+$/.test(mailIdParam) ? Number(mailIdParam) : null
  const mailboxesQuery = useMailboxes()
  const mailboxes = mailboxesQuery.data ?? []
  const selectedMailbox = useMemo(
    () => resolveMailbox(mailboxKey, mailboxes),
    [mailboxKey, mailboxes],
  )
  const mailboxView = resolveMailboxView(mailboxKey, selectedMailbox)

  const normalMailsQuery = useMailboxMails(
    selectedMailbox?.id ?? null,
    page,
    30,
    mailboxKey !== 'starred' && mailboxKey !== 'archive' && mailboxKey !== 'deleted',
  )
  const allMailsQuery = useAllMails(
    0,
    100,
    mailboxKey === 'starred' || mailboxKey === 'archive',
  )
  const deletedMailsQuery = useDeletedMails(page, 30, true)
  const detailQuery = useMailDetail(mailId)
  const detail = detailQuery.data
  const starred = detail?.isStarred ?? false
  const archived = detail?.mailboxType === 'ARCHIVE'

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
        data?.content.filter((mail) => !mail.seen).length ?? 0
    })
    counts.deleted = deletedMailsQuery.data?.total ?? 0
    return counts
  }, [countQueries, deletedMailsQuery.data?.total, systemMailboxes])

  const sourceMails = useMemo(() => {
    if (mailboxKey === 'starred') {
      return allMailsQuery.data?.content.filter((mail) => mail.isStarred) ?? []
    }
    if (mailboxKey === 'archive') {
      return allMailsQuery.data?.content.filter((mail) => mail.mailboxType === 'ARCHIVE') ?? []
    }
    if (mailboxKey === 'deleted') {
      return deletedMailsQuery.data?.content ?? []
    }
    return normalMailsQuery.data?.content ?? []
  }, [
    allMailsQuery.data?.content,
    deletedMailsQuery.data?.content,
    mailboxKey,
    normalMailsQuery.data?.content,
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
      unreadOnly
    ) {
      return visibleMails.length
    }
    if (mailboxKey === 'deleted') {
      return deletedMailsQuery.data?.total ?? 0
    }
    return normalMailsQuery.data?.total ?? 0
  }, [
    deletedMailsQuery.data?.total,
    deferredSearch,
    mailboxKey,
    normalMailsQuery.data?.total,
    unreadOnly,
    visibleMails.length,
  ])

  const totalPages =
    mailboxKey === 'deleted'
      ? deletedMailsQuery.data?.totalPages ?? 1
      : mailboxKey === 'starred' || mailboxKey === 'archive'
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

  const invalidateMailData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: MAILS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: MAIL_DETAIL_QUERY_KEY }),
    ])
  }

  const markReadMutation = useMutation({
    mutationFn: (id: number) => setMailRead(id, true),
    onSuccess: invalidateMailData,
  })

  const starMutation = useMutation({
    mutationFn: ({ id, starred }: { id: number; starred: boolean }) =>
      setMailStarred(id, starred),
    onSuccess: invalidateMailData,
    onError: (error) => {
      pushToast({ message: getApiErrorMessage(error), tone: 'danger' })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: ({ id, archived }: { id: number; archived: boolean }) =>
      setMailArchived(id, archived),
    onSuccess: invalidateMailData,
    onError: (error) => {
      pushToast({ message: getApiErrorMessage(error), tone: 'danger' })
    },
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, mailboxId }: { id: number; mailboxId: number }) =>
      moveMail(id, mailboxId),
    onSuccess: async () => {
      await invalidateMailData()
      navigate(`/mail/${mailboxKey}`)
      pushToast({ message: 'Message moved.', tone: 'success' })
    },
    onError: (error) => {
      pushToast({ message: getApiErrorMessage(error), tone: 'danger' })
    },
  })

  const archiveFolders = useMemo(
    () =>
      mailboxes
        .filter((mailbox) => mailbox.type === 'ARCHIVE' && mailbox.label)
        .map((mailbox) => ({ id: mailbox.id, name: mailbox.name })),
    [mailboxes],
  )

  const toggleArchive = (id: number) => {
    const current =
      id === mailId
        ? archived
        : ((normalMailsQuery.data?.content.find((mail) => mail.id === id) ??
            allMailsQuery.data?.content.find((mail) => mail.id === id))?.mailboxType ===
          'ARCHIVE')
    archiveMutation.mutate({ id, archived: !current })
    navigate(`/mail/${mailboxKey}`)
    pushToast({
      message: current ? 'Message restored.' : 'Message archived.',
      tone: 'success',
    })
  }

  const toggleStar = (id: number) => {
    const current =
      id === mailId
        ? (detail?.isStarred ?? false)
        : (normalMailsQuery.data?.content.find((mail) => mail.id === id)?.isStarred ??
          allMailsQuery.data?.content.find((mail) => mail.id === id)?.isStarred ??
          false)
    starMutation.mutate({ id, starred: !current })
  }

  const readSyncedId = useRef<number | null>(null)
  useEffect(() => {
    if (!detail || detail.seen || readSyncedId.current === detail.id) return
    readSyncedId.current = detail.id
    markReadMutation.mutate(detail.id)
  }, [detail, markReadMutation])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => setMailDeleted(id, true),
    onSuccess: async (_, id) => {
      await invalidateMailData()
      if (id === mailId) navigate(`/mail/${mailboxKey}`, { replace: true })
      pushToast({ message: 'Message deleted.', tone: 'success' })
    },
    onError: (error) => {
      pushToast({ message: getApiErrorMessage(error), tone: 'danger' })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: number) => setMailDeleted(id, false),
    onSuccess: async (_, id) => {
      await invalidateMailData()
      if (id === mailId) navigate(`/mail/${mailboxKey}`, { replace: true })
      pushToast({ message: 'Message restored.', tone: 'success' })
    },
    onError: (error) => {
      pushToast({ message: getApiErrorMessage(error), tone: 'danger' })
    },
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: permanentlyDeleteMail,
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: [...MAIL_DETAIL_QUERY_KEY, id] })
      await queryClient.invalidateQueries({ queryKey: MAILS_QUERY_KEY })
      if (id === mailId) navigate('/mail/deleted', { replace: true })
      pushToast({ message: 'Message permanently deleted.', tone: 'success' })
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
    if (mailboxView === 'DELETED') {
      if (window.confirm('Delete this message permanently? This cannot be undone.')) {
        permanentDeleteMutation.mutate(detail.id)
      }
      return
    }
    if (window.confirm('Delete this message?')) deleteMutation.mutate(detail.id)
  }

  const handleRestore = () => {
    if (detail && window.confirm('Restore this message to its original mailbox?')) {
      restoreMutation.mutate(detail.id)
    }
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
    } else if (mailboxKey === 'deleted') {
      void deletedMailsQuery.refetch()
    } else {
      void normalMailsQuery.refetch()
    }
  }

  const activeListQuery =
    mailboxKey === 'deleted'
      ? deletedMailsQuery
      : mailboxKey === 'starred' || mailboxKey === 'archive'
        ? allMailsQuery
        : normalMailsQuery
  const listLoading = mailboxesQuery.isLoading || activeListQuery.isLoading
  const listError = mailboxesQuery.isError || activeListQuery.isError

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
              className={cn(activeListQuery.isFetching && 'animate-spin')}
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
              mailboxView={mailboxView}
              selectedId={mailId}
              loading={listLoading}
              error={listError}
              page={page}
              totalPages={totalPages}
              total={total}
              search={search}
              unreadOnly={unreadOnly}
              sort={sort}
              refreshing={activeListQuery.isFetching}
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
              mailboxView={mailboxView}
              loading={detailQuery.isLoading}
              error={detailQuery.isError}
              starred={starred}
              archived={archived}
              archiveFolders={archiveFolders}
              onBack={() => navigate(`/mail/${mailboxKey}`)}
              onToggleStar={() => {
                if (mailId !== null) toggleStar(mailId)
              }}
              onToggleArchive={() => {
                if (mailId !== null) toggleArchive(mailId)
              }}
              onMoveToFolder={(mailboxId) => {
                if (mailId !== null) moveMutation.mutate({ id: mailId, mailboxId })
              }}
              onReply={openReply}
              onEditDraft={openDraft}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onPermanentDelete={handleDelete}
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
