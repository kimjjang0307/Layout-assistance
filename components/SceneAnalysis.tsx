import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { BotIcon, UserIcon, SendIcon, MagicWandIcon } from './Icons';

interface SceneAnalysisProps {
  chatHistory: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  onAnalyze: () => void;
  onContinueChat: (newMessage: string) => void;
  disabled: boolean;
}

// A safer, React-idiomatic way to render formatted message content from the AI.
// This avoids dangerouslySetInnerHTML by parsing the content into JSX elements.
const MessageContent: React.FC<{ text: string }> = ({ text }) => {
    // Helper to apply inline formatting like **bold**
    const applyInlineFormatting = (line: string, key: string | number) => {
        const parts = line.split(/(\*\*.*?\*\*)/g).filter(Boolean);
        return (
            <React.Fragment key={key}>
                {parts.map((part, i) => 
                    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
                )}
            </React.Fragment>
        );
    };

    // Split text into blocks (paragraphs, lists, etc.) separated by empty lines
    const blocks = text.split(/\n\s*\n/);

    return (
        <div className="leading-relaxed text-left">
            {blocks.map((block, i) => {
                if (!block.trim()) return null;

                const lines = block.split('\n');
                const firstLine = lines[0].trim();

                // Render headings (##)
                if (firstLine.startsWith('## ')) {
                    return <h3 key={i} className="text-lg font-semibold mt-4 mb-2 text-neutral-100">{applyInlineFormatting(firstLine.substring(3), 'h')}</h3>;
                }
                
                // Render lists (- )
                if (lines.every(line => line.trim().startsWith('- '))) {
                    return (
                        <ul key={i} className="list-none space-y-1 pl-1 mt-2">
                            {lines.map((item, j) => (
                                <li key={j} className="flex items-start">
                                    <span className="mr-2 text-indigo-400 mt-1.5 flex-shrink-0 leading-none">&bull;</span>
                                    <span>{applyInlineFormatting(item.trim().substring(2), `li-${j}`)}</span>
                                </li>
                            ))}
                        </ul>
                    );
                }

                // Render paragraphs
                return <p key={i} className="mt-2 first:mt-0">{applyInlineFormatting(block, 'p')}</p>;
            })}
        </div>
    );
};

export const SceneAnalysis: React.FC<SceneAnalysisProps> = ({ 
  chatHistory, 
  isLoading, 
  error, 
  onAnalyze, 
  onContinueChat, 
  disabled,
}) => {
  const [chatMessage, setChatMessage] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Auto-scroll to the bottom of the chat window
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim() && !isLoading) {
      onContinueChat(chatMessage.trim());
      setChatMessage('');
    }
  };

  return (
    <div className="bg-[#282828] rounded-xl p-5 shadow-md border border-neutral-700/50 flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-neutral-100">5. AI 분석</h2>
      </div>
      <p className="text-sm text-neutral-400 mb-4">
        AI와의 대화를 통해 장면을 분석하고 피드백을 받으세요. 필요시 '재분석' 버튼을 눌러 AI의 기술적 해석을 확인할 수 있습니다.
      </p>

      <div className="mt-4 flex flex-col gap-4 flex-grow">
        <div ref={chatContainerRef} className="flex-grow h-40 overflow-y-auto space-y-4 pr-2 rounded-lg bg-neutral-900/30 p-4 border border-neutral-700/50">
          {chatHistory.map((msg, index) => (
            <div key={index} className={`flex gap-3 items-start ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'model' && <div className="w-7 h-7 flex-shrink-0 rounded-full bg-indigo-500 text-white flex items-center justify-center" aria-label="AI"><BotIcon width="16" height="16"/></div>}
              <div className={`text-sm rounded-lg p-3 max-w-[90%] ${msg.role === 'model' ? 'bg-neutral-700 text-neutral-200' : 'bg-blue-600 text-white'}`}>
                {msg.parts.map((part, i) => <MessageContent key={i} text={part.text} />)}
              </div>
              {msg.role === 'user' && <div className="w-7 h-7 flex-shrink-0 rounded-full bg-neutral-600 text-white flex items-center justify-center" aria-label="User"><UserIcon width="16" height="16"/></div>}
            </div>
          ))}
          {isLoading && chatHistory.length > 0 && (
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 flex-shrink-0 rounded-full bg-indigo-500 text-white flex items-center justify-center" aria-label="AI"><BotIcon width="16" height="16"/></div>
              <div className="text-sm rounded-lg p-3 bg-neutral-700 text-neutral-200">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          )}
          {error && <div className="text-red-400 text-sm p-3 bg-red-900/30 rounded-lg" role="alert">{error}</div>}
        </div>
        
        <div className="flex flex-col gap-4">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="AI에게 질문하기..."
              disabled={isLoading || disabled}
              className="flex-grow p-2 bg-neutral-700/80 border border-neutral-600/80 rounded-md text-neutral-200 placeholder-neutral-500 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="AI에게 보낼 메시지"
            />
            <button
              type="submit"
              disabled={isLoading || !chatMessage.trim() || disabled}
              className="flex-shrink-0 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-900/50 disabled:cursor-not-allowed"
              aria-label="메시지 보내기"
            >
              <SendIcon />
            </button>
          </form>
          
          <button
            type="button"
            onClick={onAnalyze}
            disabled={isLoading || disabled}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-neutral-600 hover:bg-neutral-500 text-neutral-100 font-medium rounded-md transition-colors disabled:opacity-50 text-sm"
            title="현재 설정으로 다시 분석하기"
          >
            {isLoading && chatHistory.length === 0 ? (
                <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                분석 중...
                </>
            ) : (
                <>
                <MagicWandIcon />
                현재 설정으로 재분석
                </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
