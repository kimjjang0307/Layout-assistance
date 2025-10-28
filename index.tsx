

import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SplashScreen } from './components/SplashScreen';
import { GuestAuthScreen } from './components/GuestAuthScreen';
import { MasterLoginScreen } from './components/MasterLoginScreen';
import { GuestStatus, GuestRecord } from './types'; // Import GuestRecord

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const RootComponent: React.FC = () => {
  const [userMode, setUserMode] = useState<'master' | 'guest' | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  // Renamed guestStatus to localGuestStatus to reflect it's specific to this guest instance
  const [localGuestStatus, setLocalGuestStatus] = useState<GuestStatus | null>(null); 
  const [isMasterLoggedIn, setIsMasterLoggedIn] = useState<boolean>(false);

  // Load guest ID and master status from localStorage on initial render
  useEffect(() => {
    try {
      const storedGuestId = localStorage.getItem('guest_id');
      if (storedGuestId) {
        setGuestId(storedGuestId);
      }

      const storedMasterLogin = localStorage.getItem('master_logged_in');
      if (storedMasterLogin === 'true') {
        setIsMasterLoggedIn(true);
      }
    } catch (error) {
      console.error("Failed to load status from localStorage:", error);
    }
  }, []);

  // Update localStorage when guestId changes
  useEffect(() => {
    try {
      if (guestId) {
        localStorage.setItem('guest_id', guestId);
      } else {
        localStorage.removeItem('guest_id');
      }
      // Removed guestStatus from being directly saved here, as it's derived from master_guest_requests
    } catch (error) {
      console.error("Failed to save guest ID to localStorage:", error);
    }
  }, [guestId]);

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
    // localGuestStatus will be updated by the polling effect, not directly here.
  }, []);

  const handleMasterLoginSuccess = useCallback(() => {
    setIsMasterLoggedIn(true);
    // No need to change userMode here as it should already be 'master'
  }, []);

  const handleMasterLogout = useCallback(() => {
    setIsMasterLoggedIn(false);
    setUserMode(null); // Return to splash screen after logout
  }, []);

  // Poll localStorage for master_guest_requests to update local guest status
  useEffect(() => {
    const fetchAndUpdateGuestStatus = () => {
      if (userMode === 'guest' && guestId) {
        try {
          const storedRecords = localStorage.getItem('master_guest_requests');
          if (storedRecords) {
            const allGuestRecords: GuestRecord[] = JSON.parse(storedRecords);
            const thisGuestRecord = allGuestRecords.find(r => r.id === guestId);
            if (thisGuestRecord && thisGuestRecord.status !== localGuestStatus) {
              setLocalGuestStatus(thisGuestRecord.status);
            } else if (!thisGuestRecord && localGuestStatus) {
               // If the guest record was deleted by master, reset local status
               setLocalGuestStatus(null);
               setGuestId(null); // Also clear guestId to prompt re-request
            }
          } else if (localGuestStatus) {
              // If master cleared all records
              setLocalGuestStatus(null);
              setGuestId(null);
          }
        } catch (error) {
          console.error("Error polling master_guest_requests for guest status:", error);
        }
      }
    };

    const interval = setInterval(fetchAndUpdateGuestStatus, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [userMode, guestId, localGuestStatus]);


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
    if (localGuestStatus === 'allowed' && guestId) { // Use localGuestStatus here
      content = <App userMode="guest" />;
    } else {
      content = (
        <GuestAuthScreen
          onLoginSuccess={handleGuestLoginSuccess}
          currentGuestId={guestId}
          // No longer passing currentStatus directly, GuestAuthScreen will manage it internally
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