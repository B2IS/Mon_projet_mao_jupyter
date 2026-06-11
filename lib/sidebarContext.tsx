'use client';
import { createContext, useContext } from 'react';

interface SidebarCtx {
  open: boolean;
  toggle: () => void;
  close: () => void;
  /** Mobile drawer — contrôlé par le topbar mobile dans le layout */
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
}
export const SidebarContext = createContext<SidebarCtx>({
  open: true, toggle: () => {}, close: () => {},
  mobileOpen: false, openMobile: () => {}, closeMobile: () => {},
});
export const useSidebar = () => useContext(SidebarContext);
