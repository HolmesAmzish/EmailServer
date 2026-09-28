export type MailboxType = 'INBOX' | 'SENT' | 'DRAFT' | 'TRASH' | 'CUSTOM'

export interface PageResponse<T> {
  content: T[]
  total: number
  page: number
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
  fromAddress: string | null
  replyTo: string | null
  deliveredTo: string | null
  subject: string | null
  sentAt: string | null
  receivedAt: string | null
  seen: boolean
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
  fromAddress: string | null
  replyTo: string | null
  subject: string | null
  sentAt: string | null
  receivedAt: string | null
  deliveredTo: string | null
  seen: boolean
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
