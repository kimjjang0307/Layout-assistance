
import React, { useState, useEffect } from 'react';
import { LockIcon, MagicWandIcon } from './Icons';

interface MasterLoginScreenProps {
  onLoginSuccess: () => void;
}

export const MasterLoginScreen: React.FC<MasterLoginScreenProps> = ({ onLoginSuccess }) => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const MASTER_ID = 'ddrw133';
  const MASTER_PASSWORD = 'Isform123456';
  const MASTER_EMAIL = 'ddrw133@nate.com';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      if (id === MASTER_ID && password === MASTER_PASSWORD && email === MASTER_EMAIL) {
        onLoginSuccess();
      } else {
        setError('잘못된 ID, 비밀번호 또는 이메일입니다.');
      }
      setIsLoading(false);
    }, 1000); // Simulate network delay
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-black flex flex-col items-center justify-center z-50 p-4 text-white animate-fade-in">
      <div className="text-center max-w-lg px-8 py-10 bg-black/30 rounded-2xl shadow-2xl border border-gray-700/50 backdrop-blur-sm">
        <MagicWandIcon className="mx-auto text-blue-400 mb-6" width="80" height="80" />
        <h1 className="text-4xl font-extrabold tracking-tight mb-4 text-neutral-100">
          마스터 로그인
        </h1>
        <p className="text-lg text-neutral-300 mb-8 leading-relaxed">
          마스터 대시보드 및 모든 기능에 접근하려면 로그인하십시오.
        </p>

        <form onSubmit={handleLogin} className="flex flex-col gap-5 mb-8">
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="ID"
            className="w-full p-3 bg-neutral-700 border border-neutral-600 rounded-md text-neutral-200 placeholder-neutral-500 text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
            aria-label="마스터 ID"
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="w-full p-3 bg-neutral-700 border border-neutral-600 rounded-md text-neutral-200 placeholder-neutral-500 text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
            aria-label="마스터 비밀번호"
            autoComplete="current-password"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            className="w-full p-3 bg-neutral-700 border border-neutral-600 rounded-md text-neutral-200 placeholder-neutral-500 text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
            aria-label="마스터 이메일"
            autoComplete="email"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 flex items-center justify-center mx-auto gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
            aria-label="로그인"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                로그인 중...
              </>
            ) : (
              '로그인'
            )}
          </button>
        </form>
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
      `}</style>
    </div>
  );
};
