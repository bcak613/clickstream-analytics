'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface SidebarCtxType {
  isOpen: boolean;
  open:   () => void;
  close:  () => void;
  toggle: () => void;
}

const SidebarCtx = createContext<SidebarCtxType>({
  isOpen: false,
  open:   () => {},
  close:  () => {},
  toggle: () => {},
});

export const useSidebar = () => useContext(SidebarCtx);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open   = useCallback(() => setIsOpen(true),  []);
  const close  = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(v => !v), []);
  return (
    <SidebarCtx.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </SidebarCtx.Provider>
  );
}
