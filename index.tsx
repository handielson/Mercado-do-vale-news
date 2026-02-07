
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Build Version: 2026-02-07-18:00 - Force clean build
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
