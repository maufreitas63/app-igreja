import {
  installDevClickTraceConsoleHelpers,
  readDebugClicksFromUrl,
} from '@/lib/devClickTrace';
import { useDevNavigationTrace } from '@/hooks/useDevNavigationTrace';
import { useEffect } from 'react';

export function DevClickTraceBootstrap() {
  useDevNavigationTrace();

  useEffect(() => {
    readDebugClicksFromUrl();
    installDevClickTraceConsoleHelpers();
  }, []);

  return null;
}
