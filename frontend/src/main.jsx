import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n/index';
import './index.css';

// Prevent arrow keys from incrementing/decrementing number inputs
document.addEventListener('keydown', (e) => {
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.target.type === 'number') {
    e.preventDefault();
  }
});

// Prevent scroll wheel from changing number inputs
document.addEventListener('wheel', (e) => {
  if (e.target.type === 'number') e.target.blur();
}, { passive: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
