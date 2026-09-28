export type MailboxType = 'INBOX' | 'SENT' | 'DRAFT' | 'TRASH' | 'ARCHIVE'
export type MailViewType = MailboxType | 'STARRED' | 'DELETED'

export interface PageResponse<T> {
  content: T[]
  total: number
  page: number
  size: number
  totalPages: number
  last: boolean
}

export interface SpringPage<T> {
  content: T[]
  totalElements: number
  number: number
  size: number
  totalPages: number
  last: boolean
}

export interface Mailbox {
  id: number
  label: string | null
  name: string
  type: MailboxType
  createdAt: string | null
  updateAt: string | null
}

export interface MailSummary {
  id: number
  mailboxType: MailboxType
  fromAddress: string | null
  replyTo: string | null
  deliveredTo: string | null
  subject: string | null
  sentAt: string | null
  receivedAt: string | null
  seen: boolean
  isStarred: boolean
  isDeleted: boolean
  textContent: string | null
}

export interface Attachment {
  id: number
  filename: string | null
  contentType: string | null
  size: number
}

export interface MailDetail {
  id: number
  mailboxType: MailboxType
  fromAddress: string | null
  replyTo: string | null
  subject: string | null
  sentAt: string | null
  receivedAt: string | null
  deliveredTo: string | null
  seen: boolean
  isStarred: boolean
  isDeleted: boolean
  textContent: string | null
  htmlContent: string | null
  rawPath: string | null
  attachments: Attachment[]
}

export interface MailboxUpsertInput {
  mailboxName: string
  label: string
}

export interface MailComposeInput {
  to: string
  subject: string
  content: string
}

export interface AuthUser {
  id: string
  username: string
  email: string
}
