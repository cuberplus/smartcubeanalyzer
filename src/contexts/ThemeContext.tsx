import React from 'react';

export type ThemeContextValue = {
  isDark: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
};

export const ThemeContext = React.createContext<ThemeContextValue>({
  isDark: false,
  setTheme: () => {},
});
