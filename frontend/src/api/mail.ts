import { del, get, patch, post, put } from './client'
import type {
  Mailbox,
  MailboxUpsertInput,
  MailComposeInput,
  MailDetail,
  MailSummary,
  PageResponse,
  SpringPage,
} from '@/types/mail'

const pageQuery = (page: number, size: number) =>
  new URLSearchParams({
    page: String(page),
    size: String(size),
  }).toString()

export const fetchMailboxes = (): Promise<Mailbox[]> => get<Mailbox[]>('/api/mailbox')

export const fetchMailboxMails = async (
  mailboxId: number,
  page: number,
  size: number,
): Promise<PageResponse<MailSummary>> => {
  const response = await get<SpringPage<MailSummary>>(
    `/api/mailbox/${mailboxId}/mails?${pageQuery(page, size)}`,
  )
  return normalizeSpringPage(response)
}

export const fetchAllMails = (page = 0, size = 100): Promise<PageResponse<MailSummary>> =>
  get<PageResponse<MailSummary>>(`/api/mail?${pageQuery(page, size)}`)

export const fetchMailDetail = (id: number): Promise<MailDetail> =>
  get<MailDetail>(`/api/mail/${id}`)

export const markMailRead = (id: number): Promise<void> =>
  patch<void>(`/api/mail/${id}`)

export const deleteMail = (id: number): Promise<void> =>
  del<void>(`/api/mail/${id}`)

export const createDraft = (input: MailComposeInput): Promise<MailDetail> =>
  post<MailDetail, MailComposeInput>('/api/mail/draft', input)

export const updateDraft = (id: number, input: MailComposeInput): Promise<MailDetail> =>
  put<MailDetail, MailComposeInput>(`/api/mail/${id}`, input)

export const sendMail = (input: MailComposeInput): Promise<MailDetail> =>
  post<MailDetail, MailComposeInput>('/api/mail/send', input)

export const createMailbox = (input: MailboxUpsertInput): Promise<void> =>
  post<void, URLSearchParams>(`/api/mailbox`, toMailboxForm(input), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

export const updateMailbox = (id: number, input: MailboxUpsertInput): Promise<void> =>
  put<void, URLSearchParams>(`/api/mailbox/${id}`, toMailboxForm(input), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

export const deleteMailbox = (id: number): Promise<void> =>
  del<void>(`/api/mailbox/${id}`)

// Reserved endpoint contract for attachment storage. The current backend returns metadata only.
export const downloadAttachment = (id: number): Promise<Blob> =>
  get<Blob>(`/api/mail/attachments/${id}/download`, { responseType: 'blob' })

function toMailboxForm(input: MailboxUpsertInput): URLSearchParams {
  const form = new URLSearchParams()
  form.set('mailboxName', input.mailboxName)
  form.set('label', input.label)
  return form
}

function normalizeSpringPage<T>(page: SpringPage<T>): PageResponse<T> {
  return {
    content: page.content,
    total: page.totalElements,
    page: page.number,
    size: page.size,
    totalPages: page.totalPages,
    last: page.last,
  }
}
