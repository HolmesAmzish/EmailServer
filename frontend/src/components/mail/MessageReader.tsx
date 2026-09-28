import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Download,
  File,
  FilePenLine,
  MailOpen,
  Reply,
  Star,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatFileSize, formatFullDate, initials } from '@/lib/format'
import type {
  Attachment,
  MailboxType,
  MailDetail,
} from '@/types/mail'

interface MessageReaderProps {
  mail: MailDetail | undefined
  mailboxType: MailboxType | 'STARRED' | 'ARCHIVE'
  loading: boolean
  error: boolean
  starred: boolean
  archived: boolean
  onBack: () => void
  onToggleStar: () => void
  onToggleArchive: () => void
  onReply: () => void
  onEditDraft: () => void
  onDelete: () => void
  onDownloadAttachment: (attachment: Attachment) => void
}

function htmlDocument(html: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: cid: https:; style-src 'unsafe-inline'; font-src data:;" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; background: #ffffff; color: #1d1d1f; }
      body { padding: 20px; font: 14px/1.6 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; overflow-wrap: anywhere; }
      img { max-width: 100%; height: auto; }
      table { max-width: 100%; }
      a { color: #0047ff; }
      blockquote { margin-left: 0; padding-left: 14px; border-left: 2px solid #e8e8ed; color: #6e6e73; }
    </style>
  </head>
  <body>${html}</body>
</html>`
}

function AttachmentRow({
  attachment,
  onDownload,
}: {
  attachment: Attachment
  onDownload: () => void
}) {
  return (
    <button
      type="button"
      onClick={onDownload}
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-muted"
      title={`Download ${attachment.filename ?? 'attachment'}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <File size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium text-foreground">
          {attachment.filename || 'Attachment'}
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {attachment.contentType || 'Unknown type'} · {formatFileSize(attachment.size)}
        </div>
      </div>
      <Download
        size={14}
        className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
      />
    </button>
  )
}

function ReaderEmpty() {
  return (
    <div className="flex h-full min-h-[520px] w-full flex-col items-center justify-center bg-background/45 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
        <MailOpen size={24} strokeWidth={1.6} />
      </div>
      <p className="mt-4 text-[13px] font-medium text-foreground">Select a message</p>
      <p className="mt-1 max-w-[250px] text-[12px] text-muted-foreground">
        Choose a message from the list to read it here.
      </p>
    </div>
  )
}

export function MessageReader({
  mail,
  mailboxType,
  loading,
  error,
  starred,
  archived,
  onBack,
  onToggleStar,
  onToggleArchive,
  onReply,
  onEditDraft,
  onDelete,
  onDownloadAttachment,
}: MessageReaderProps) {
  if (loading && !mail) {
    return (
      <section className="flex h-full min-h-0 w-full flex-1 items-center justify-center bg-background/45">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </section>
    )
  }

  if (error && !mail) {
    return (
      <section className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center bg-background/45 p-8 text-center">
        <p className="text-[13px] font-medium text-danger">Message could not be opened.</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          It may have been moved or deleted.
        </p>
      </section>
    )
  }

  if (!mail) return <ReaderEmpty />

  const sender = mail.fromAddress || 'Unknown sender'
  const recipient = mail.deliveredTo || mail.replyTo
  const messageDate = mail.receivedAt ?? mail.sentAt

  return (
    <section className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-background/45">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-3 backdrop-blur-xl lg:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            aria-label="Back to message list"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="truncate text-[12px] font-medium text-muted-foreground">
            {mailboxType === 'DRAFT' ? 'Draft' : 'Message'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onToggleArchive}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={archived ? 'Restore from archive' : 'Archive message'}
          >
            {archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
          </button>
          <button
            type="button"
            onClick={onToggleStar}
            className={cn(
              'rounded-lg p-2 transition-colors hover:bg-muted',
              starred ? 'text-warning' : 'text-muted-foreground hover:text-foreground',
            )}
            title={starred ? 'Remove star' : 'Star message'}
          >
            <Star size={15} fill={starred ? 'currentColor' : 'none'} />
          </button>
          {mailboxType === 'DRAFT' ? (
            <button
              type="button"
              onClick={onEditDraft}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Continue editing"
            >
              <FilePenLine size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onReply}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Reply"
            >
              <Reply size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
            title={mailboxType === 'TRASH' ? 'Delete permanently' : 'Move to trash'}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto w-full max-w-[920px] px-5 py-6 lg:px-8 lg:py-8">
          <div className="mb-6">
            <h1 className="text-[20px] font-semibold leading-tight text-foreground lg:text-[22px]">
              {mail.subject || '(No subject)'}
            </h1>

            <div className="mt-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-semibold text-background">
                {initials(sender)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-foreground">
                      {sender}
                    </span>
                    <span className="block truncate text-[12px] text-muted-foreground">
                      {recipient ? `to ${recipient}` : 'No recipient'}
                    </span>
                  </div>
                  <time
                    className="shrink-0 text-[11px] text-muted-foreground"
                    dateTime={messageDate ?? undefined}
                  >
                    {formatFullDate(messageDate)}
                  </time>
                </div>
              </div>
            </div>
          </div>

          {mail.htmlContent ? (
            <iframe
              title="Message content"
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={htmlDocument(mail.htmlContent)}
              className="min-h-[520px] w-full rounded-[var(--radius)] border border-border bg-white"
            />
          ) : (
            <div className="whitespace-pre-wrap break-words text-[13px] leading-6 text-foreground">
              {mail.textContent || 'This message has no content.'}
            </div>
          )}

          {mail.attachments.length > 0 ? (
            <div className="mt-8 border-t border-border pt-6">
              <div className="mb-3 text-[11px] font-medium text-muted-foreground">
                {mail.attachments.length}{' '}
                {mail.attachments.length === 1 ? 'attachment' : 'attachments'}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {mail.attachments.map((attachment) => (
                  <AttachmentRow
                    key={attachment.id}
                    attachment={attachment}
                    onDownload={() => onDownloadAttachment(attachment)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  )
}
