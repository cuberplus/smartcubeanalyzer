import React from 'react';
import ReactDOM from 'react-dom/client';
import './CSS/index.css';
import App from './Components/App';
import 'bootstrap/dist/css/bootstrap.css';
import "./CSS/Style.css";

// Note: the benign ResizeObserver warning is suppressed in public/theme-init.js,
// which loads before this bundle. See the comment there for why it can't live here.

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
