import React from 'react';
import { createRoot } from 'react-dom/client';
import './tokens.css';
import './styles.css';
import { SchemeSaathiApp } from './components';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SchemeSaathiApp initialLang="hi" />
  </React.StrictMode>
);
