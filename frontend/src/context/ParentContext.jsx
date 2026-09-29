import { createContext, useContext, useEffect, useState } from 'react';
import { ParentApi } from '../api/endpoints';
import { useAuth } from './AuthContext';

const ParentContext = createContext(null);

export function ParentProvider({ children }) {
  const { user } = useAuth();
  const [childList, setChildList] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(() => {
    try {
      return localStorage.getItem('srms_selected_child') || '';
    } catch {
      return '';
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'parent') {
      setLoading(false);
      return;
    }
    ParentApi.children()
      .then((res) => {
        setChildList(res.data);
        setSelectedChildId((prev) => {
          const stillValid = res.data.some((c) => c.id === prev);
          const next = stillValid ? prev : res.data[0]?.id || '';
          try {
            localStorage.setItem('srms_selected_child', next);
          } catch {
            // ignore
          }
          return next;
        });
      })
      .finally(() => setLoading(false));
  }, [user?.role]);

  const selectChild = (id) => {
    setSelectedChildId(id);
    try {
      localStorage.setItem('srms_selected_child', id);
    } catch {
      // ignore
    }
  };

  return (
    <ParentContext.Provider value={{ children: childList, selectedChildId, selectChild, loading }}>
      {children}
    </ParentContext.Provider>
  );
}

export function useParentContext() {
  const ctx = useContext(ParentContext);
  if (!ctx) throw new Error('useParentContext must be used within ParentProvider');
  return ctx;
}
