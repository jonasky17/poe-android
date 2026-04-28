'use no memo';

import React, { createContext, ReactNode, useState } from 'react';

interface DrawerContextType {
  isOpen: boolean;
  toggleDrawer: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

export const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDrawer = () => setIsOpen((prev) => !prev);
  const openDrawer = () => setIsOpen(true);
  const closeDrawer = () => setIsOpen(false);

  return (
    <DrawerContext.Provider value={{ isOpen, toggleDrawer, openDrawer, closeDrawer }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const context = React.useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used within DrawerProvider');
  }
  return context;
}
