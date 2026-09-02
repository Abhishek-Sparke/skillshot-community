import { requireChatGPTUser } from '../chatgpt-auth';
import AccountCenter from '../components/account-center';
import PublicNavbar from '../components/public-navbar';

export default async function Page() {
  await requireChatGPTUser('/notifications');
  return <><PublicNavbar returnTo="/notifications"/><main className="accountPage shell"><AccountCenter section="notifications"/></main></>;
}
