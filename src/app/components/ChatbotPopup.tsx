import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, MessageCircle, X, Minimize2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { API_BASE, getAuthToken } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const getAIResponse = async (userMessage: string): Promise<string> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: userMessage }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    const errorMessage = typeof payload?.error === 'string' && payload.error.trim() !== ''
      ? payload.error
      : 'Failed to fetch assistant response';
    throw new Error(errorMessage);
  }

  const payload = await response.json().catch(() => null) as { reply?: string; message?: string } | null;
  const text = payload?.reply ?? payload?.message;
  if (typeof text === 'string' && text.trim() !== '') {
    return text;
  }

  throw new Error('Assistant returned an empty response');
};

export const ChatbotPopup = () => {
  const { locale, t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: t('assistantGreeting'),
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setMessages((currentMessages) => {
      if (currentMessages.length !== 1 || currentMessages[0]?.role !== 'assistant') {
        return currentMessages;
      }

      return [
        {
          ...currentMessages[0],
          content: t('assistantGreeting'),
        },
      ];
    });
  }, [locale, t]);

  const predefinedQuestions = [t('question1'), t('question2'), t('question3')];

  const handleSendMessage = async (message?: string) => {
    const messageToSend = message || inputValue.trim();
    
    if (!messageToSend) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    let aiResponse = "I'm having trouble responding right now. Please try again in a moment.";
    try {
      aiResponse = await getAIResponse(messageToSend);
    } catch (error) {
      if (error instanceof Error && error.message.trim() !== '') {
        aiResponse = error.message;
      }
    }
    
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsTyping(false);
    
    if (!isOpen) {
      setUnreadCount(prev => prev + 1);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 md:bottom-6 md:right-6 z-50 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
      >
        <MessageCircle size={24} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
        <span className="absolute right-full mr-3 bg-gray-900 text-white px-3 py-1 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {t('askAssistant')}
        </span>
      </button>
    );
  }

  return (
    <div className={`fixed z-50 transition-all duration-300 ${
      isMinimized 
        ? 'bottom-24 right-6 md:bottom-6 md:right-6 w-80 h-16' 
        : 'bottom-24 right-6 md:bottom-6 md:right-6 w-full md:w-96 h-[600px] max-h-[calc(100vh-180px)] md:max-h-[600px] max-w-[calc(100vw-3rem)]'
    }`}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 rounded-full p-2">
              <Bot size={20} />
            </div>
            <div>
              <h3 className="font-semibold">{t('assistantTitle')}</h3>
              <p className="text-xs text-emerald-100">{t('assistantSubtitle')}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="hover:bg-white/20 rounded-full p-1.5 transition-colors"
            >
              <Minimize2 size={18} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 rounded-full p-1.5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Chat Messages Area */}
            <ScrollArea className="flex-1 min-h-0 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start space-x-2 ${
                      message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}
                  >
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm ${
                      message.role === 'assistant' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {message.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                    </div>
                    <div className={`flex-1 ${
                      message.role === 'user' ? 'flex justify-end' : ''
                    }`}>
                      <div className={`rounded-2xl px-3 py-2 max-w-[85%] ${
                        message.role === 'assistant'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-emerald-600 text-white'
                      }`}>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        <p className={`text-[10px] mt-1 ${
                          message.role === 'assistant' ? 'text-gray-500' : 'text-emerald-100'
                        }`}>
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex items-start space-x-2">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Bot size={14} />
                    </div>
                    <div className="bg-gray-100 rounded-2xl px-3 py-2">
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Quick Questions */}
            {messages.length === 1 && (
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                <p className="text-[10px] font-medium text-gray-500 mb-1.5">{t('quickQuestions')}</p>
                <div className="flex flex-col gap-1.5">
                  {predefinedQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(question)}
                      className="text-[10px] px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors duration-200 text-left"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-3 border-t border-gray-200 bg-white rounded-b-2xl">
              <div className="flex space-x-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t('assistantPlaceholder')}
                  className="flex-1 text-sm rounded-full border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                  disabled={isTyping}
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isTyping}
                  className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white p-2 h-9 w-9"
                  size="sm"
                >
                  {isTyping ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Send size={14} />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};