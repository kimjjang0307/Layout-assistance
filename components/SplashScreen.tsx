
import React, { useState } from 'react';
import { MagicWandIcon } from './Icons';

interface SplashScreenProps {
  onSelectMode: (mode: 'master' | 'guest') => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onSelectMode }) => {
  const [showModeButtons, setShowModeButtons] = useState(false);

  const handleStartClick = () => {
    setShowModeButtons(true);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-black flex flex-col items-center justify-center z-50 p-4 text-white animate-fade-in">
      <div className="text-center max-w-2xl px-6 py-10 bg-black/30 rounded-2xl shadow-2xl border border-gray-700/50 backdrop-blur-sm">
        <MagicWandIcon className="mx-auto text-blue-400 mb-6 animate-pulse-slow" width="80" height="80" />
        <h1 className="text-5xl font-extrabold tracking-tight mb-4 text-neutral-100">
          AI 애니메이션 레이아웃 어시스턴트
        </h1>
        <p className="text-lg text-neutral-300 mb-8 leading-relaxed">
          당신의 아이디어를 실현하는 데 필요한 모든 것을 갖춘
          차세대 애니메이션 레이아웃 및 캐릭터 포징 도구입니다.
          AI의 도움을 받아 창작 과정을 한 단계 업그레이드하세요.
        </p>
        <div className="h-20 flex flex-col sm:flex-row gap-4 justify-center items-center">
          {!showModeButtons ? (
            <div className="animate-fade-in-buttons">
              <button
                onClick={handleStartClick}
                className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-2xl rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 flex items-center justify-center mx-auto gap-3"
                aria-label="시작하기"
              >
                <span className="animate-bounce-y-slow">시작하기</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-buttons">
              <button
                onClick={() => onSelectMode('master')}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50"
                aria-label="마스터 모드로 시작"
              >
                마스터 로그인
              </button>
              <button
                onClick={() => onSelectMode('guest')}
                className="px-8 py-4 bg-neutral-600 hover:bg-neutral-700 text-white font-bold text-xl rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-neutral-500 focus:ring-opacity-50"
                aria-label="게스트 모드로 시작"
              >
                게스트 로그인
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
        }
        @keyframes fade-in-buttons {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-buttons {
          animation: fade-in-buttons 0.5s ease-out forwards;
        }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s infinite ease-in-out;
        }
        @keyframes bounce-y-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-y-slow {
          animation: bounce-y-slow 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};
