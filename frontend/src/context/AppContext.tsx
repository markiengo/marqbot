"use client";

import React, { createContext, useContext, useReducer, type Dispatch } from "react";
import type { AppState } from "@/lib/types";
import { appReducer, initialState, type AppAction } from "./AppReducer";

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
  children: React.ReactNode;
  initialStateValue?: AppState;
}

export function AppProvider({ children, initialStateValue }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialStateValue ?? initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
