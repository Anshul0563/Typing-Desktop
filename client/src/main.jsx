import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from './context/AuthContext.jsx';
import { SiteSettingsProvider } from './context/SiteSettingsContext.jsx';
import App from './App.jsx';
import { GlobalLoader } from './components/GlobalLoader.jsx';
import './styles.css';

const Router = import.meta.env.VITE_DESKTOP === 'true' ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><Router><SiteSettingsProvider><AuthProvider><GlobalLoader /><App />{import.meta.env.VITE_DESKTOP !== 'true' && <Analytics />}</AuthProvider></SiteSettingsProvider></Router></React.StrictMode>
);
