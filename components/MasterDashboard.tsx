
import React, { useState, useEffect, useCallback } from 'react';
import { UserIcon, LockIcon, UnlockIcon, TrashIcon, ResetIcon, CloseIcon } from './Icons';
import { GuestRecord, GuestStatus } from '../types'; // GuestRecord 및 GuestStatus import

// Dummy data for demonstration - now used only if localStorage is empty
const initialDummyUserRecords: GuestRecord[] = [
  { id: 'guest_001', ipAddress: '192.168.1.100', loginTime: '2024-08-01 10:30:00', status: 'allowed' },
  { id: 'guest_002', ipAddress: '10.0.0.5', loginTime: '2024-08-01 11:15:23', status: 'pending' },
  { id: 'guest_003', ipAddress: '172.16.0.20', loginTime: '2024-08-01 14:05:10', status: 'blocked' },
  { id: 'guest_004', ipAddress: '192.168.1.101', loginTime: '2024-08-02 09:00:00', status: 'allowed' },
  { id: 'guest_005', ipAddress: '10.0.0.6', loginTime: '2024-08-02 10:20:00', status: 'pending' },
];

export const MasterDashboard: React.FC = () => {
  const [userRecords, setUserRecords] = useState<GuestRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Effect to load records and poll for updates
  useEffect(() => {
    const loadAndPollRecords = () => {
      try {
        const storedRecords = localStorage.getItem('master_guest_requests');
        if (storedRecords) {
          const parsedRecords: GuestRecord[] = JSON.parse(storedRecords);
          // Deep comparison to avoid unnecessary state updates
          if (JSON.stringify(parsedRecords) !== JSON.stringify(userRecords)) {
            setUserRecords(parsedRecords);
          }
        } else {
          // If localStorage is empty, and userRecords is also empty, initialize with dummy data and save it.
          // This ensures the dashboard isn't always empty if it's the first time running.
          if (userRecords.length === 0) { 
            setUserRecords(initialDummyUserRecords);
            localStorage.setItem('master_guest_requests', JSON.stringify(initialDummyUserRecords));
          }
        }
      } catch (error) {
        console.error("Failed to load guest records from localStorage:", error);
        // Fallback to dummy data if loading from localStorage fails AND current state is empty
        if (userRecords.length === 0) {
          setUserRecords(initialDummyUserRecords);
        }
      }
    };

    loadAndPollRecords(); // Load on initial mount

    const interval = setInterval(loadAndPollRecords, 3000); // Poll every 3 seconds

    return () => clearInterval(interval); // Cleanup interval on unmount
  }, [userRecords]); // Dependency array to trigger effect if userRecords changes externally (e.g., manual localStorage edit)


  const handleToggleAllow = useCallback((id: string) => {
    setUserRecords(prevRecords => {
      const updatedRecords = prevRecords.map(record => {
        if (record.id === id) {
          const newStatus: GuestStatus = record.status === 'allowed' ? 'blocked' : 'allowed';
          return { ...record, status: newStatus };
        }
        return record;
      });
      localStorage.setItem('master_guest_requests', JSON.stringify(updatedRecords)); // Save updated array
      return updatedRecords;
    });
  }, []);

  const handleDeleteRecord = useCallback((id: string) => {
    setUserRecords(prevRecords => {
      const updatedRecords = prevRecords.filter(record => record.id !== id);
      localStorage.setItem('master_guest_requests', JSON.stringify(updatedRecords)); // Save updated array
      return updatedRecords;
    });
    // No need to clear global 'guest_id' or 'guest_status' as those are no longer used for status.
  }, []);

  const handleResetRecords = useCallback(() => {
    setUserRecords([]); // Clear all records in state
    localStorage.removeItem('master_guest_requests'); // Clear central storage
    setSearchTerm(''); // Clear search term
    // No need to clear global 'guest_id' or 'guest_status'
  }, []);

  const handleClearPendingBlocked = useCallback(() => {
    setUserRecords(prevRecords => {
      const updatedRecords = prevRecords.filter(record => record.status === 'allowed');
      localStorage.setItem('master_guest_requests', JSON.stringify(updatedRecords)); // Save updated array
      return updatedRecords;
    });
    // No need to clear global 'guest_id' or 'guest_status'
  }, []);

  const filteredRecords = userRecords.filter(record =>
    record.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.ipAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-[#282828] rounded-xl p-6 shadow-md border border-neutral-700/50 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-neutral-100 flex items-center gap-3">
          <UserIcon width="24" height="24" />
          마스터 대시보드
        </h2>
        <div className="flex gap-2">
            <button
              onClick={handleClearPendingBlocked}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-700 hover:bg-yellow-600 text-neutral-100 font-medium rounded-md transition-colors text-sm"
              title="모든 대기/차단 기록 삭제"
            >
              <CloseIcon width="16" height="16" />
              대기/차단 요청 삭제
            </button>
            <button
              onClick={handleResetRecords}
              className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-neutral-100 font-medium rounded-md transition-colors text-sm"
              title="모든 기록 초기화"
            >
              <ResetIcon width="16" height="16" />
              모든 기록 초기화
            </button>
        </div>
      </div>

      <p className="text-neutral-400 text-sm mb-6">
        이 대시보드에서는 게스트 사용자들의 로그인 기록과 접근 권한을 관리할 수 있습니다.
        (현재는 더미 데이터로 표시됩니다.)
      </p>

      <div className="mb-4">
        <input
          type="text"
          placeholder="사용자 ID, IP 주소 또는 상태 검색 (예: pending)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 bg-neutral-700 border border-neutral-600 rounded-md text-neutral-200 placeholder-neutral-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="flex-grow overflow-hidden">
        <div className="overflow-y-auto max-h-full">
          {filteredRecords.length === 0 ? (
            <p className="text-neutral-500 text-center py-8">일치하는 사용자 기록이 없습니다.</p>
          ) : (
            <table className="min-w-full bg-neutral-800 rounded-lg overflow-hidden">
              <thead className="bg-neutral-700 sticky top-0">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">ID</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">IP 주소</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">최근 로그인 요청</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">상태</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-neutral-700/70 transition-colors">
                    <td className="py-3 px-4 text-sm font-mono text-neutral-300">{record.id}</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">{record.ipAddress}</td>
                    <td className="py-3 px-4 text-sm text-neutral-400">{record.loginTime}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          record.status === 'allowed' ? 'bg-green-600 text-white' :
                          record.status === 'blocked' ? 'bg-red-600 text-white' :
                          'bg-yellow-600 text-white'
                        }`}
                      >
                        {record.status === 'allowed' ? '허용' : record.status === 'blocked' ? '차단' : '대기 중'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-200">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleAllow(record.id)}
                          className={`p-2 rounded-md transition-colors ${
                            record.status === 'allowed'
                              ? 'bg-red-700 hover:bg-red-600'
                              : 'bg-green-700 hover:bg-green-600'
                          }`}
                          title={record.status === 'allowed' ? '접근 차단' : '접근 허용'}
                        >
                          {record.status === 'allowed' ? <LockIcon width="16" height="16" /> : <UnlockIcon width="16" height="16" />}
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="p-2 rounded-md bg-neutral-600 hover:bg-neutral-500 transition-colors"
                          title="기록 삭제"
                        >
                          <TrashIcon width="16" height="16" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};