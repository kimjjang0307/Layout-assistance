import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SplashScreen } from './components/SplashScreen';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const RootComponent: React.FC = () => {
  const [userMode, setUserMode] = useState<'master' | 'guest' | null>(null);

  const handleSelectMode = (mode: 'master' | 'guest') => {
    setUserMode(mode);
  };

  return (
    <React.StrictMode>
      {userMode === null ? (
        <SplashScreen onSelectMode={handleSelectMode} />
      ) : (
        <App userMode={userMode} />
      )}
    </React.StrictMode>
  );
};

const root = ReactDOM.createRoot(rootElement);
root.render(<RootComponent />);