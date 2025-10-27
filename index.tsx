

import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SplashScreen } from './components/SplashScreen';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const RootComponent: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);

  const handleStart = () => {
    setShowSplash(false);
  };

  return (
    <React.StrictMode>
      {showSplash ? <SplashScreen onStart={handleStart} /> : <App />}
    </React.StrictMode>
  );
};

const root = ReactDOM.createRoot(rootElement);
root.render(<RootComponent />);