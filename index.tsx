
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SplashScreen } from './components/SplashScreen';
import { GuestAuthScreen } from './components/GuestAuthScreen';
import { MasterLoginScreen } from './components/MasterLoginScreen';
import { GuestStatus } from './types';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const RootComponent: React.FC = () => {
  const [userMode, setUserMode] = useState<'master' | 'guest' | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestStatus, setGuestStatus] = useState<GuestStatus | null>(null);
  const [isMasterLoggedIn, setIsMasterLoggedIn] = useState<boolean>(false);

  // Load guest and master status from localStorage on initial render
  useEffect(() => {
    try {
      const storedGuestId = localStorage.getItem('guest_id');
      const storedGuestStatus = localStorage.getItem('guest_status');
      if (storedGuestId) {
        setGuestId(storedGuestId);
      }
      if (storedGuestStatus && ['pending', 'allowed', 'blocked'].includes(storedGuestStatus)) {
        setGuestStatus(storedGuestStatus as GuestStatus);
      }

      const storedMasterLogin = localStorage.getItem('master_logged_in');
      if (storedMasterLogin === 'true') {
        setIsMasterLoggedIn(true);
      }
    } catch (error) {
      console.error("Failed to load status from localStorage:", error);
    }
  }, []);

  // Update localStorage when guestId or guestStatus changes
  useEffect(() => {
    try {
      if (guestId) {
        localStorage.setItem('guest_id', guestId);
      } else {
        localStorage.removeItem('guest_id');
      }
      if (guestStatus) {
        localStorage.setItem('guest_status', guestStatus);
      } else {
        localStorage.removeItem('guest_status');
      }
    } catch (error) {
      console.error("Failed to save guest status to localStorage:", error);
    }
  }, [guestId, guestStatus]);

  // Update localStorage when master login status changes
  useEffect(() => {
    try {
      if (isMasterLoggedIn) {
        localStorage.setItem('master_logged_in', 'true');
      } else {
        localStorage.removeItem('master_logged_in');
      }
    } catch (error) {
      console.error("Failed to save master login status to localStorage:", error);
    }
  }, [isMasterLoggedIn]);

  const handleSelectMode = useCallback((mode: 'master' | 'guest') => {
    setUserMode(mode);
    // If switching modes, ensure login states are reset appropriately if not persistent across modes.
    // For this demo, master login persists but guest login is separate.
    if (mode === 'guest' && isMasterLoggedIn) {
        // Option to log out master when switching to guest. For now, keep them logged in.
        // setIsMasterLoggedIn(false); 
    }
  }, [isMasterLoggedIn]);

  const handleGuestLoginSuccess = useCallback((id: string) => {
    setGuestId(id);
    setGuestStatus('allowed');
  }, []);

  const handleMasterLoginSuccess = useCallback(() => {
    setIsMasterLoggedIn(true);
    // No need to change userMode here as it should already be 'master'
  }, []);

  const handleMasterLogout = useCallback(() => {
    setIsMasterLoggedIn(false);
    setUserMode(null); // Return to splash screen after logout
  }, []);

  // Poll localStorage for guest status updates (e.g., from master dashboard)
  useEffect(() => {
    const interval = setInterval(() => {
      if (userMode === 'guest' && guestId) {
        try {
          const updatedStatus = localStorage.getItem('guest_status') as GuestStatus;
          // Only update if status has actually changed and is valid
          if (updatedStatus && updatedStatus !== guestStatus && ['pending', 'allowed', 'blocked'].includes(updatedStatus)) {
            setGuestStatus(updatedStatus);
          }
        } catch (error) {
          console.error("Error polling guest status:", error);
        }
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [userMode, guestId, guestStatus]);


  let content;
  if (userMode === null) {
    content = <SplashScreen onSelectMode={handleSelectMode} />;
  } else if (userMode === 'master') {
    if (isMasterLoggedIn) {
      content = <App userMode="master" onMasterLogout={handleMasterLogout} />;
    } else {
      content = <MasterLoginScreen onLoginSuccess={handleMasterLoginSuccess} />;
    }
  } else { // userMode === 'guest'
    if (guestStatus === 'allowed' && guestId) {
      content = <App userMode="guest" />;
    } else {
      content = (
        <GuestAuthScreen
          onLoginSuccess={handleGuestLoginSuccess}
          currentGuestId={guestId}
          currentStatus={guestStatus}
        />
      );
    }
  }

  return (
    <React.StrictMode>
      {content}
    </React.StrictMode>
  );
};

const root = ReactDOM.createRoot(rootElement);
root.render(<RootComponent />);
    