'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageLoader } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function HomePage() {
  const { status } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === 'authenticated') router.replace('/app');
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);
  return <PageLoader />;
}
