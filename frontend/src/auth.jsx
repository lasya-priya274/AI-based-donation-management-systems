import React, { createContext, useContext, useEffect, useState } from "react";
import { api, getToken } from "./api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) return setReady(true);
    api("/auth/me/").then(setUser).catch(() => localStorage.removeItem("token")).finally(() => setReady(true));
  }, []);

  const signIn = (token, u) => { localStorage.setItem("token", token); setUser(u); };
  const signOut = () => { localStorage.removeItem("token"); setUser(null); };
  return <Ctx.Provider value={{ user, ready, signIn, signOut }}>{children}</Ctx.Provider>;
}
