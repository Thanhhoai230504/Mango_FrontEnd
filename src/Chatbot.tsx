import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatbotProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

const MangoChatbot: React.FC<ChatbotProps> = ({ isOpen = false, onToggle }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Xin chào! 🥭 Tôi là trợ lý AI chuyên về xoài. Bạn muốn hỏi gì về loại quả tuyệt vời này?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    try {
      const response = await fetch("http://localhost:8000/chat/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: inputValue }),
      });

      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();

      setTimeout(() => {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.answer,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        setIsTyping(false);
      }, 1000);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all z-50 flex items-center justify-center pulse-animation"
        >
          <span className="text-3xl">🤖</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col z-50 slide-in-right">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 border-b border-white/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-4xl float-animation">🥭</div>
                <div>
                  <h1 className="text-xl font-bold text-white">
                    Mango Expert AI
                  </h1>
                  <p className="text-white/80 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full pulse-animation"></span>
                    Luôn online
                  </p>
                </div>
              </div>
              <button
                onClick={onToggle}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
              >
                <span className="text-white text-xl">×</span>
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-custom bg-gradient-to-b from-purple-50 to-indigo-50">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`flex gap-2 ${
                  message.isUser
                    ? "flex-row-reverse slide-in-right"
                    : "slide-in-left"
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.isUser
                      ? "bg-gradient-to-br from-purple-500 to-indigo-600"
                      : "bg-white"
                  }`}
                >
                  {message.isUser ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-purple-600" />
                  )}
                </div>

                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-md ${
                    message.isUser
                      ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white"
                      : "bg-white text-gray-800"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.text}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-2 slide-in-left">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-purple-600" />
                </div>
                <div className="bg-white rounded-2xl px-4 py-2 shadow-md">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-purple-600 rounded-full typing-dot"></div>
                    <div className="w-2 h-2 bg-purple-600 rounded-full typing-dot"></div>
                    <div className="w-2 h-2 bg-purple-600 rounded-full typing-dot"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Container */}
          <div className="bg-white px-4 py-3 border-t border-gray-200">
            <div className="flex gap-2 items-end">
              <textarea
                className="flex-1 bg-gray-100 rounded-xl px-4 py-2 text-gray-800 placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all text-sm"
                placeholder="Hỏi tôi về xoài..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isTyping}
                rows={1}
                style={{ maxHeight: "80px" }}
              />
              <button
                onClick={handleSend}
                disabled={isTyping || !inputValue.trim()}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  isTyping || !inputValue.trim()
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-br from-purple-500 to-indigo-600 hover:scale-105 active:scale-95 shadow-lg"
                }`}
              >
                {isTyping ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Send className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animations CSS */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse-scale {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes bounce-dot {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .float-animation { animation: float 3s ease-in-out infinite; }
        .pulse-animation { animation: pulse-scale 2s ease-in-out infinite; }
        .slide-in-right { animation: slide-in-right 0.4s ease-out; }
        .slide-in-left { animation: slide-in-left 0.4s ease-out; }
        .typing-dot {
          animation: bounce-dot 1.4s infinite ease-in-out both;
        }
        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }
        .scrollbar-custom::-webkit-scrollbar { width: 4px; }
        .scrollbar-custom::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-custom::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.3); border-radius: 2px; }
      `}</style>
    </>
  );
};

export default MangoChatbot;
