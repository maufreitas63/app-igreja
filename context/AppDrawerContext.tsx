import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type AppDrawerContextValue = {
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

const AppDrawerContext = createContext<AppDrawerContextValue>({
  isOpen: false,
  openDrawer: () => undefined,
  closeDrawer: () => undefined,
  toggleDrawer: () => undefined,
});

export function AppDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openDrawer = useCallback(() => setIsOpen(true), []);
  const closeDrawer = useCallback(() => setIsOpen(false), []);
  const toggleDrawer = useCallback(() => setIsOpen((current) => !current), []);

  const value = useMemo(
    () => ({ isOpen, openDrawer, closeDrawer, toggleDrawer }),
    [closeDrawer, isOpen, openDrawer, toggleDrawer]
  );

  return <AppDrawerContext.Provider value={value}>{children}</AppDrawerContext.Provider>;
}

export function useAppDrawer() {
  return useContext(AppDrawerContext);
}
