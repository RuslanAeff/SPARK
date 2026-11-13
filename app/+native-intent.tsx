// S.P.A.R.K. — Gelen sistem bağlantıları yönlendiriciden önce burada süzülür (SEC-08).
import { filterIncomingLink } from '../src/utils/deepLinkGuard';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  return filterIncomingLink(path);
}
