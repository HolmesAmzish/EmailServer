import { useQuery } from '@tanstack/react-query'
import { fetchMailDetail } from '@/api/mail'
import { MAIL_DETAIL_QUERY_KEY } from './useMails'

export function useMailDetail(id: number | null) {
  return useQuery({
    queryKey: [...MAIL_DETAIL_QUERY_KEY, id],
    queryFn: () => fetchMailDetail(id as number),
    enabled: id !== null,
    staleTime: 15_000,
  })
}
