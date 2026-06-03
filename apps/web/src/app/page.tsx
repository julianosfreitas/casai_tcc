'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  React.useEffect(() => {
    router.replace(getToken() ? '/dashboard' : '/login');
  }, [router]);
  return null;
}
