import React, { useState, useEffect, useCallback } from 'react';
import { FileInput } from './FileInput';
import { ThemeContext } from '../contexts/ThemeContext';
import { APP_VERSION } from '../Helpers/Version';
import "../CSS/Style.css";
import ReactGA from 'react-ga4';

function getInitialIsDark(): boolean {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored === 'dark';
  return true;
}

function App() {
  ReactGA.initialize('G-BHXNCQ3K0D');
  ReactGA.send({ hitType: "pageview", page: window.location.pathname });

  const [isDark, setIsDark] = useState(getInitialIsDark);

  useEffect(() => {
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem('theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#0d1117' : '#000000');
  }, [isDark]);

  const setTheme = useCallback((theme: 'light' | 'dark') => setIsDark(theme === 'dark'), []);

  return (
    <ThemeContext.Provider value={{ isDark, setTheme }}>
      <div className="App">
        <FileInput />
        <footer id="footer" className="app-version">v{APP_VERSION}</footer>
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
