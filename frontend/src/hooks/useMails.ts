import { useQuery } from '@tanstack/react-query'
import { fetchAllMails, fetchMailboxMails } from '@/api/mail'

export const MAILS_QUERY_KEY = ['mails'] as const
export const MAIL_DETAIL_QUERY_KEY = ['mail-detail'] as const

export function useMailboxMails(
  mailboxId: number | null,
  page: number,
  size: number,
  enabled = true,
) {
  return useQuery({
    queryKey: [...MAILS_QUERY_KEY, mailboxId, page, size],
    queryFn: () => fetchMailboxMails(mailboxId as number, page, size),
    enabled: enabled && mailboxId !== null,
    staleTime: 15_000,
  })
}

export function useAllMails(page = 0, size = 100, enabled = true) {
  return useQuery({
    queryKey: [...MAILS_QUERY_KEY, 'all', page, size],
    queryFn: () => fetchAllMails(page, size),
    enabled,
    staleTime: 15_000,
  })
}
