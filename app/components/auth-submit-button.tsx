'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';

export default function AuthSubmitButton({ children, pendingText, className }: { children: ReactNode; pendingText: string; className: string }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending} aria-busy={pending}>
    {pending ? pendingText : children}
  </button>;
}
