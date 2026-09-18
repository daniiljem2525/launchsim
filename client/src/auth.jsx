import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const AuthCtx = createContext(null);
export function useAuth() { return useContext(AuthCtx); }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ aiConfigured: false, googleConfigured: false });

  const refresh = useCallback(async () => {
    try {
      const d = await api.me();
      setUser(d.user);
      setMeta({ aiConfigured: d.aiConfigured, googleConfigured: d.googleConfigured, demoEmail: d.demoEmail });
    } catch { setUser(null); }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = {
    user, loading, meta, refresh,
    setUser,
    logout: async () => { await api.logout(); setUser(null); },
    enterDemo: async () => {
      const d = await api.demo();
      await refresh();
      return d.demoProjectId;
    },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
