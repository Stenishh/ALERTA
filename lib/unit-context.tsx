"use client";

import { createContext, useContext, useState, useSyncExternalStore } from "react";

interface UnitContextType {
  unitName: string;
  setUnitName: (name: string) => void;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

const DEFAULT_UNIT_NAME = "Fetin";
const THEME_STORAGE_KEY = "alerta-theme";
const THEME_CHANGE_EVENT = "alerta-theme-change";

function isDarkTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function subscribeToTheme(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY) return;
    if (event.newValue === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    onChange();
  }

  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const UnitContext = createContext<UnitContextType>({
  unitName: DEFAULT_UNIT_NAME,
  setUnitName: () => {},
  darkMode: false,
  setDarkMode: () => {},
});

export function UnitProvider({ children }: { children: React.ReactNode }) {
  const [unitName, setUnitName] = useState(DEFAULT_UNIT_NAME);
  const darkMode = useSyncExternalStore(subscribeToTheme, isDarkTheme, () => false);

  function setDarkMode(value: boolean) {
    if (value) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value ? "dark" : "light");
    } catch {
      // A escolha permanece ativa na página atual.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <UnitContext.Provider value={{ unitName, setUnitName, darkMode, setDarkMode }}>
      {children}
    </UnitContext.Provider>
  );
}

export function useUnit() {
  return useContext(UnitContext);
}
