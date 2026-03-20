import React from 'react';
import ReactDOM from 'react-dom/client';
import './CSS/index.css';
import App from './Components/App';
import 'bootstrap/dist/css/bootstrap.css';
import "./CSS/Style.css";

// Chart.js uses ResizeObserver internally; this benign warning fires when the
// observer callback can't deliver notifications within a single animation frame.
window.addEventListener('error', (e) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
    e.stopImmediatePropagation();
  }
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
