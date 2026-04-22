import React from 'react';
import ReactDOM from 'react-dom/client';
import { Buffer } from 'buffer';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

window.Buffer = Buffer;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
