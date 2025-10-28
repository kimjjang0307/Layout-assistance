
import React, { useState, useEffect, useCallback } from 'react';
import { MagicWandIcon, LockIcon, UnlockIcon } from './Icons';
// FIX: Import GuestRecord from types
import { GuestStatus, GuestRecord } from '../types';

interface GuestAuthScreenProps {
  onLoginSuccess: (guestId: string) => void;
  currentGuestId: string | null; // Keep this to pre-fill the input
  // currentStatus: GuestStatus | null; // REMOVE this prop, GuestAuthScreen will manage it internally
}

export const GuestAuthScreen: React.FC<GuestAuthScreenProps> = ({ onLoginSuccess, currentGuestId }) => { // Update props
  const [inputGuestId, setInputGuestId] = useState(currentGuestId || '');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isRequesting, setIsRequesting] = useState(false);
  // New state to hold this specific guest's status, derived from master_guest_requests
  const [guestSpecificStatus, setGuestSpecificStatus] = useState<GuestStatus | null>(null); 

  const getStatusText = useCallback((status: GuestStatus | null) => {
    switch (status) {
      case 'pending':
        return '접근 요청이 마스터에게 전송되었습니다. 승인 대기 중입니다.';
      case 'allowed':
        return '접근이 승인되었습니다. 앱으로 이동합니다.';
      case 'blocked':
        return '접근이 거부되었습니다. 마스터에게 문의하세요.';
      default:
        return '접근을 위해 사용자 ID를 입력하고 요청해주세요.';
    }
  }, []);

  // Effect to continuously check this guest's status from master_guest_requests
  useEffect(() => {
    const checkGuestStatus = () => {
      if (inputGuestId.trim()) {
        try {
          const storedRecords = localStorage.getItem('master_guest_requests');
          if (storedRecords) {
            const allGuestRecords: GuestRecord[] = JSON.parse(storedRecords);
            const thisGuestRecord = allGuestRecords.find(r => r.id === inputGuestId.trim());
            if (thisGuestRecord) {
              if (thisGuestRecord.status !== guestSpecificStatus) {
                setGuestSpecificStatus(thisGuestRecord.status);
              }
            } else if (guestSpecificStatus) {
              // If this guest's record was deleted by the master
              setGuestSpecificStatus(null);
              // In this case, the RootComponent will also detect the missing guestId and clear it.
            }
          } else if (guestSpecificStatus) {
            // If all records were cleared by master
            setGuestSpecificStatus(null);
          }
        } catch (error) {
          console.error("Error checking guest status from master_guest_requests:", error);
        }
      }
    };

    // Initial check and then poll
    checkGuestStatus();
    const interval = setInterval(checkGuestStatus, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [inputGuestId, guestSpecificStatus]); // Dependencies changed

  // Effect to handle status change messages and login
  useEffect(() => {
    setStatusMessage(getStatusText(guestSpecificStatus));
    if (guestSpecificStatus === 'allowed' && inputGuestId.trim()) {
      const timer = setTimeout(() => {
        onLoginSuccess(inputGuestId.trim());
      }, 2000); // 2초 후 로그인 성공 처리
      return () => clearTimeout(timer);
    }
  }, [guestSpecificStatus, inputGuestId, onLoginSuccess, getStatusText]);

  const handleRequestAccess = () => {
    if (!inputGuestId.trim()) {
      setStatusMessage('사용자 ID를 입력해야 합니다.');
      return;
    }
    
    setIsRequesting(true);
    
    const guestIdTrimmed = inputGuestId.trim();
    const now = new Date().toLocaleString();

    try {
      // Retrieve master's list of guest requests
      const storedRequests = localStorage.getItem('master_guest_requests');
      let masterGuestRequests: GuestRecord[] = storedRequests ? JSON.parse(storedRequests) : [];
      
      const existingIndex = masterGuestRequests.findIndex(r => r.id === guestIdTrimmed);
      if (existingIndex !== -1) {
        // Update existing record with new login time and set status to pending
        masterGuestRequests[existingIndex] = { 
          ...masterGuestRequests[existingIndex], 
          loginTime: now, 
          status: 'pending' // Always set to pending on re-request
        };
      } else {
        // Add new record
        masterGuestRequests.push({
          id: guestIdTrimmed,
          ipAddress: '127.0.0.1', // Placeholder. In a real app, this would come from the server.
          loginTime: now,
          status: 'pending' as GuestStatus,
        });
      }
      localStorage.setItem('master_guest_requests', JSON.stringify(masterGuestRequests));
      
      // Store this guest's ID locally for persistence
      localStorage.setItem('guest_id', guestIdTrimmed);
      
      setStatusMessage(getStatusText('pending')); // Temporarily show pending locally
      setGuestSpecificStatus('pending'); // Update local state immediately
      setIsRequesting(false);
    } catch (error) {
      console.error("게스트 접근 요청 중 오류 발생:", error);
      setStatusMessage("접근 요청 중 오류가 발생했습니다.");
      setIsRequesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-black flex flex-col items-center justify-center z-50 p-4 text-white animate-fade-in">
      <div className="text-center max-w-2xl px-6 py-10 bg-black/30 rounded-2xl shadow-2xl border border-gray-700/50 backdrop-blur-sm">
        <LockIcon className="mx-auto text-blue-400 mb-6 animate-pulse-slow" width="80" height="80" />
        <h1 className="text-5xl font-extrabold tracking-tight mb-4 text-neutral-100">
          게스트 접근 요청
        </h1>
        <p className="text-lg text-neutral-300 mb-8 leading-relaxed">
          게스트 모드에 접근하려면 사용자 ID를 입력하고 마스터의 승인을 받아야 합니다.
        </p>
        
        <div className="flex flex-col gap-4 mb-8">
          <input
            type="text"
            value={inputGuestId}
            onChange={(e) => setInputGuestId(e.target.value)}
            placeholder="사용자 ID를 입력하세요 (예: Guest001)"
            className="w-full p-3 bg-neutral-700 border border-neutral-600 rounded-md text-neutral-200 placeholder-neutral-500 text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isRequesting || guestSpecificStatus === 'allowed'}
            aria-label="게스트 사용자 ID"
          />
          <button
            onClick={handleRequestAccess}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 flex items-center justify-center mx-auto gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isRequesting || guestSpecificStatus === 'allowed'}
            aria-label="접근 요청"
          >
            {isRequesting ? (
              <>
                <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                요청 중...
              </>
            ) : (
              '접근 요청'
            )}
          </button>
        </div>

        <p className={`text-lg font-semibold ${
          guestSpecificStatus === 'allowed' ? 'text-green-400' :
          guestSpecificStatus === 'blocked' ? 'text-red-400' :
          'text-neutral-300'
        }`}>
          상태: {statusMessage}
        </p>
      </div>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
        }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};