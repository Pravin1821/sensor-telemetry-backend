import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, setToken, setUnauthorizedHandler } from './api';

const KEY = 'auth_token';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [ready, setReady] = useState(false); // false while we check for a saved token

  const signOut = useCallback(async () => {
    setToken(null);
    setTokenState(null);
    await SecureStore.deleteItemAsync(KEY).catch(() => {});
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(KEY);
        if (saved) {
          setToken(saved);
          setTokenState(saved);
        }
      } catch {}
      setReady(true);
    })();
  }, [signOut]);

  const signIn = async (username, password) => {
    const { token: t } = await api.login(username, password);
    setToken(t);
    setTokenState(t);
    await SecureStore.setItemAsync(KEY, t);
  };

  return (
    <AuthContext.Provider value={{ token, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);