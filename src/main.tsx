import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './pwa';

const root = document.getElementById('root');

ReactDOM.createRoot(root!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
