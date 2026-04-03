import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, MessageCircle, X, Minimize2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Mock AI responses for olive tree care recommendations
const getAIResponse = (userMessage: string): string => {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('irrigation') || lowerMessage.includes('water')) {
    return "For olive trees, irrigation is crucial especially during dry periods. Young trees (1-3 years) need weekly watering, while mature trees can handle deeper, less frequent irrigation. During fruit development (May-August), ensure consistent moisture. A good rule of thumb is 40-50 gallons per week for mature trees. Monitor soil moisture at 12-18 inches depth.";
  }
  
  if (lowerMessage.includes('medication') || lowerMessage.includes('treatment') || lowerMessage.includes('disease') || lowerMessage.includes('pest')) {
    return "Common olive tree issues include peacock spot fungus, olive fruit fly, and verticillium wilt. For peacock spot, apply copper-based fungicides in fall/spring. For olive fruit fly, use kaolin clay or spinosad-based treatments. Always follow organic practices when possible and apply treatments during cooler hours to avoid leaf burn.";
  }
  
  if (lowerMessage.includes('fertiliz')) {
    return "Olive trees benefit from nitrogen-rich fertilizer in spring (March-April). Apply 1-2 pounds of actual nitrogen per year of tree age, up to 20 pounds for mature trees. Use slow-release organic fertilizers and avoid over-fertilizing, which can reduce fruit quality. Compost around the base is also beneficial.";
  }
  
  if (lowerMessage.includes('prune') || lowerMessage.includes('trim')) {
    return "Prune olive trees in late winter or early spring before new growth begins. Remove dead, damaged, or crossing branches. Maintain an open center (vase shape) to allow light penetration and air circulation. Remove suckers from the base. Light annual pruning is better than severe pruning every few years.";
  }
  
  if (lowerMessage.includes('harvest')) {
    return "Olive harvest timing depends on your goal: green olives are harvested in early fall (September-October), while black olives are harvested in late fall to early winter (November-January). For oil production, harvest when olives are turning from green to purple for optimal oil quality. Hand-picking or using mechanical shakers are common methods.";
  }
  
  if (lowerMessage.includes('spacing') || lowerMessage.includes('plant')) {
    return "Space olive trees 15-20 feet apart for standard varieties, or 8-10 feet for dwarf varieties. They need full sun (at least 6 hours daily) and well-draining soil with pH 6.0-8.0. Olive trees are hardy in USDA zones 8-11 and can tolerate drought once established.";
  }
  
  if (lowerMessage.includes('thank')) {
    return "You're welcome! Feel free to ask me anything about olive tree care, irrigation schedules, disease management, or general cultivation practices. I'm here to help your olive orchard thrive! 🌿";
  }
  
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return "Hello! I'm your olive tree care assistant. I can help you with irrigation schedules, disease management, fertilization, pruning techniques, and general olive cultivation advice. What would you like to know?";
  }
  
  // Default response
  return "I'm specialized in olive tree care and management. I can help with irrigation scheduling, disease and pest management, fertilization, pruning techniques, harvesting guidance, and general cultivation practices. Could you please provide more details about what you'd like to know regarding your olive trees?";
};

const predefinedQuestions = [
  "How often should I water olive trees?",
  "What are common olive tree diseases?",
  "When should I fertilize my olive trees?",
];

export const ChatbotPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your olive tree care assistant. I can provide recommendations on irrigation, medication, fertilization, pruning, and general care. How can I help?",
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

    // Simulate AI thinking time
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));

    const aiResponse = getAIResponse(messageToSend);
    
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
          Ask AI Assistant
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
              <h3 className="font-semibold">AI Assistant</h3>
              <p className="text-xs text-emerald-100">Olive tree care expert</p>
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
            <ScrollArea className="flex-1 p-4">
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
                <p className="text-[10px] font-medium text-gray-500 mb-1.5">Quick questions:</p>
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
                  placeholder="Ask about your olive trees..."
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