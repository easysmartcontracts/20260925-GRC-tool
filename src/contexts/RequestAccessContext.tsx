import React, { createContext, useContext, useState } from 'react';
import { RequestAccessModal, RequestAccessTarget } from '../components/RequestAccessModal';
import { RequestSignedCopyModal, RequestSignedCopyTarget } from '../components/RequestSignedCopyModal';

interface RequestAccessContextType {
  openRequestAccess: (target: RequestAccessTarget) => void;
  closeRequestAccess: () => void;
  openRequestSignedCopy: (target: RequestSignedCopyTarget) => void;
  closeRequestSignedCopy: () => void;
}

const RequestAccessContext = createContext<RequestAccessContextType | undefined>(undefined);

export function RequestAccessProvider({ children }: { children: React.ReactNode }) {
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const [accessTarget, setAccessTarget] = useState<RequestAccessTarget | null>(null);

  const [isSignedCopyOpen, setIsSignedCopyOpen] = useState(false);
  const [signedCopyTarget, setSignedCopyTarget] = useState<RequestSignedCopyTarget | null>(null);

  const openRequestAccess = (newTarget: RequestAccessTarget) => {
    setAccessTarget(newTarget);
    setIsAccessOpen(true);
  };

  const closeRequestAccess = () => {
    setIsAccessOpen(false);
    setAccessTarget(null);
  };

  const openRequestSignedCopy = (newTarget: RequestSignedCopyTarget) => {
    setSignedCopyTarget(newTarget);
    setIsSignedCopyOpen(true);
  };

  const closeRequestSignedCopy = () => {
    setIsSignedCopyOpen(false);
    setSignedCopyTarget(null);
  };

  return (
    <RequestAccessContext.Provider 
      value={{ 
        openRequestAccess, 
        closeRequestAccess,
        openRequestSignedCopy,
        closeRequestSignedCopy
      }}
    >
      {children}
      <RequestAccessModal 
        isOpen={isAccessOpen} 
        onClose={closeRequestAccess} 
        target={accessTarget} 
      />
      <RequestSignedCopyModal 
        isOpen={isSignedCopyOpen} 
        onClose={closeRequestSignedCopy} 
        target={signedCopyTarget} 
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
