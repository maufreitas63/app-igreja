import { AppInactiveScreen } from '@/components/AppInactiveScreen';
import { useAppActiveStatus } from '@/hooks/useAppActiveStatus';
import { DEFAULT_APP_INACTIVE_MESSAGE } from '@/lib/appActiveStatus';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

type Props = {
  children: React.ReactNode;
};

const normalizePathname = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

const isLoginRoute = (pathname: string) => {
  const normalized = normalizePathname(pathname);
  return normalized === '/' || normalized === '/index';
};

const isPublicDownloadRoute = (pathname: string) => {
  const normalized = normalizePathname(pathname);
  return normalized === '/baixar-app';
};

/**
 * Bloqueia a interface quando app_ativo = nao.
 * Super admin mantém acesso total; login administrativo fica disponível via atalho na tela de bloqueio.
 */
export function AppActiveGate({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { adminAccess } = useLocalSearchParams<{ adminAccess?: string | string[] }>();
  const { status, loading, superAdminBypass } = useAppActiveStatus();
  const [adminLoginUnlocked, setAdminLoginUnlocked] = useState(false);

  const adminAccessFromQuery = useMemo(
    () => adminAccess === '1' || (Array.isArray(adminAccess) && adminAccess.includes('1')),
    [adminAccess]
  );

  useEffect(() => {
    if (adminAccessFromQuery) {
      setAdminLoginUnlocked(true);
    }
  }, [adminAccessFromQuery]);

  useEffect(() => {
    if (status?.active) {
      setAdminLoginUnlocked(false);
    }
  }, [status?.active]);

  if (loading && !status && !isLoginRoute(pathname) && !isPublicDownloadRoute(pathname)) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!status) {
    return <>{children}</>;
  }

  if (status.active || superAdminBypass) {
    return <>{children}</>;
  }

  if (isLoginRoute(pathname) && adminLoginUnlocked) {
    return <>{children}</>;
  }

  if (isPublicDownloadRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <AppInactiveScreen
      message={status.message || DEFAULT_APP_INACTIVE_MESSAGE}
      onAdminAccessPress={() => {
        setAdminLoginUnlocked(true);
        router.replace({ pathname: '/', params: { adminAccess: '1' } });
      }}
    />
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
});
