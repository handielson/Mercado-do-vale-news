import React from 'react';

type DashboardSensitiveAccessContextValue = {
  unlocked: boolean;
  setUnlocked: (value: boolean) => void;
};

const DashboardSensitiveAccessContext = React.createContext<DashboardSensitiveAccessContextValue | null>(null);

export const DashboardSensitiveAccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unlocked, setUnlocked] = React.useState(false);

  const value = React.useMemo(() => ({ unlocked, setUnlocked }), [unlocked]);

  return (
    <DashboardSensitiveAccessContext.Provider value={value}>
      {children}
    </DashboardSensitiveAccessContext.Provider>
  );
};

export function useDashboardSensitiveAccess(): DashboardSensitiveAccessContextValue {
  const context = React.useContext(DashboardSensitiveAccessContext);
  if (!context) {
    return {
      unlocked: false,
      setUnlocked: () => {},
    };
  }
  return context;
}
