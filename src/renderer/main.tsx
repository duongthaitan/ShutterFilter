import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { setupMockElectronApi } from './mockElectronApi';
import './index.css';

setupMockElectronApi();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
