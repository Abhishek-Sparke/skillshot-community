import { requireChatGPTUser } from '../chatgpt-auth';

export default async function UploadLayout({ children }: { children: React.ReactNode }) {
  await requireChatGPTUser('/upload');
  return children;
}
