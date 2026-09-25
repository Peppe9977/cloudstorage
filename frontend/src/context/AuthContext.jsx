import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [username, setUsername] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setChecking(false);
      return;
    }
    api
      .me()
      .then((data) => setUsername(data.username))
      .catch(() => localStorage.removeItem('vault_token'))
      .finally(() => setChecking(false));
  }, []);

  async function login(user, password) {
    const data = await api.login(user, password);
    localStorage.setItem('vault_token', data.token);
    setUsername(data.username);
  }

  function logout() {
    localStorage.removeItem('vault_token');
    setUsername(null);
  }

  return (
    <AuthContext.Provider value={{ username, checking, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
