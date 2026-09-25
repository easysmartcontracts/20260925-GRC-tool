import React, { createContext, useContext, useState } from 'react';
import { RequestAccessModal, RequestAccessTarget } from '../components/RequestAccessModal';

interface RequestAccessContextType {
  openRequestAccess: (target: RequestAccessTarget) => void;
  closeRequestAccess: () => void;
}

const RequestAccessContext = createContext<RequestAccessContextType | undefined>(undefined);

export function RequestAccessProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState<RequestAccessTarget | null>(null);

  const openRequestAccess = (newTarget: RequestAccessTarget) => {
    setTarget(newTarget);
    setIsOpen(true);
  };

  const closeRequestAccess = () => {
    setIsOpen(false);
    setTarget(null);
  };

  return (
    <RequestAccessContext.Provider value={{ openRequestAccess, closeRequestAccess }}>
      {children}
      <RequestAccessModal 
        isOpen={isOpen} 
        onClose={closeRequestAccess} 
        target={target} 
      />
    </RequestAccessContext.Provider>
  );
}

export function useRequestAccess() {
  const context = useContext(RequestAccessContext);
  if (!context) {
    throw new Error('useRequestAccess must be used within a RequestAccessProvider');
  }
  return context;
}
