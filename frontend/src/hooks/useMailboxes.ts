import { useQuery } from '@tanstack/react-query'
import { fetchMailboxes } from '@/api/mail'

export const MAILBOXES_QUERY_KEY = ['mailboxes'] as const

export function useMailboxes() {
  return useQuery({
    queryKey: MAILBOXES_QUERY_KEY,
    queryFn: fetchMailboxes,
    staleTime: 60_000,
  })
}
