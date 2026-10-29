import React, { useState, useRef, useEffect } from 'react';
import { Stay, ChatThread, User } from '../types';
import { X, Send, BadgeDollarSign, Check, XCircle, Bot, Sparkles } from 'lucide-react';

interface ChatModalProps {
  stay: Stay | null;
  thread: ChatThread | null;
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (msg: { type: 'text' | 'offer' | 'counter'; text?: string; amount?: number }) => Promise<void>;
  onReplyOffer: (action: 'accept' | 'decline') => Promise<void>;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  stay,
  thread,
  user,
  isOpen,
  onClose,
  onSendMessage,
  onReplyOffer,
}) => {
  if (!isOpen || !stay) return null;

  const [inputText, setInputText] = useState('');
  const [offerInput, setOfferInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isHost = user?.email.toLowerCase() === (stay.ownerEmail || '').toLowerCase();
  const myRole = isHost ? 'host' : 'guest';
  const otherRole = isHost ? 'guest' : 'host';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread?.messages]);

  const messages = thread?.messages || [];
  const lastMsg = messages[messages.length - 1];
  const pendingOffer = messages.slice().reverse().find(m => (m.type === 'offer' || m.type === 'counter') && m.status === 'pending');
  const canActOnOffer = pendingOffer && pendingOffer.from !== myRole;

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setLoading(true);
    try {
      await onSendMessage({ type: 'text', text: inputText.trim() });
      setInputText('');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOffer = async () => {
    const val = Number(offerInput);
    if (!val || val <= 0) {
      alert('Please enter a valid offer amount.');
      return;
    }
    setLoading(true);
    try {
      await onSendMessage({
        type: pendingOffer ? 'counter' : 'offer',
        amount: val,
      });
      setOfferInput('');
    } finally {
      setLoading(false);
    }
  };

  // Demo simulation button matching the original HTML asset
  const handleSimulateReply = async () => {
    setLoading(true);
    try {
      if (pendingOffer && pendingOffer.from === myRole) {
        // Counter the offer from other side
        const simulatedVal = Math.round((pendingOffer.amount! + stay.price) / 2);
        await onSendMessage({
          type: 'counter',
          amount: simulatedVal,
        });
      } else {
        const sampleMsg =
          otherRole === 'host'
            ? 'Hello! Thanks for your interest in our property. We would be happy to host you. What dates are you looking for?'
            : 'Hi! Is this available for my upcoming trip? Can we agree on early check-in?';
        await onSendMessage({
          type: 'text',
          text: sampleMsg,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const quickReplies = isHost
    ? ['Thanks for your interest!', 'Yes, those dates are available.', 'Check-in is after 14:00.', 'Happy to discuss the price.']
    : ['Is this still available?', 'Is early check-in possible?', 'Can we negotiate the price?', 'Where is the main entrance?'];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col h-[580px] overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-stone-50 dark:bg-stone-900/80 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-white line-clamp-1">{stay.title}</h3>
            <div className="text-[11px] text-stone-500">
              You are the <span className="font-semibold text-[#e4002b] uppercase">{myRole}</span> · Listed KES {stay.price.toLocaleString()}/night
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Thread Body */}
        <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-xs">
              Say hello or make an offer to the {otherRole}.
            </div>
          ) : (
            messages.map(m => {
              const isMe = m.from === myRole;

              if (m.type === 'offer' || m.type === 'counter') {
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-2`}
                  >
                    <div
                      className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-xs font-semibold shadow-sm ${
                        isMe
                          ? 'bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-white border border-stone-300 dark:border-stone-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold mb-0.5">
                        <BadgeDollarSign className="w-3.5 h-3.5" />
                        <span>{m.type === 'counter' ? 'Counter-Offer' : 'Proposed Offer'}:</span>
                      </div>
                      <div className="text-base font-black">
                        KES {m.amount?.toLocaleString()}/night
                      </div>
                      <div className="text-[10px] opacity-80 capitalize mt-0.5">
                        Status: {m.status || 'pending'}
                      </div>
                    </div>
                  </div>
                );
              }

              if (m.type === 'accept' || m.type === 'decline') {
                return (
                  <div key={m.id} className="flex justify-center my-2">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
                        m.type === 'accept'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      {m.type === 'accept' ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {m.text || (m.type === 'accept' ? 'Offer Accepted' : 'Offer Declined')}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`px-3.5 py-2 rounded-2xl max-w-[80%] text-xs leading-relaxed ${
                      isMe
                        ? 'bg-[#e4002b] text-white rounded-br-none'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-bl-none'
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="text-[9px] text-stone-400 mt-0.5 px-1">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Pending Offer Decision Banner */}
        {canActOnOffer && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border-t border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-2">
            <div className="text-xs">
              <span className="font-bold text-stone-900 dark:text-white">
                Open Offer: KES {pendingOffer.amount?.toLocaleString()}/night
              </span>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => onReplyOffer('accept')}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs font-bold transition-colors cursor-pointer"
              >
                Accept
              </button>
              <button
                onClick={() => onReplyOffer('decline')}
                className="px-3 py-1 bg-stone-200 dark:bg-stone-800 hover:bg-rose-100 text-rose-600 rounded-full text-xs font-bold transition-colors cursor-pointer"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Quick Response Chips */}
        <div className="px-4 py-2 border-t border-stone-100 dark:border-stone-800 flex gap-1.5 overflow-x-auto text-xs">
          {quickReplies.map((qr, i) => (
            <button
              key={i}
              onClick={() => setInputText(qr)}
              className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-600 dark:text-stone-400 rounded-full shrink-0 text-[11px] font-medium transition-colors cursor-pointer"
            >
              {qr}
            </button>
          ))}
        </div>

        {/* Send Input Bar & Counter Offer Row */}
        <div className="p-3.5 bg-stone-50 dark:bg-stone-900/80 border-t border-stone-200 dark:border-stone-800 space-y-2">
          {/* Chat Form */}
          <form onSubmit={handleSendText} className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full text-xs outline-none focus:border-[#e4002b]"
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="px-4 py-2 bg-[#e4002b] text-white rounded-full text-xs font-bold hover:bg-[#c90026] disabled:opacity-50 cursor-pointer flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>

          {/* Offer Input & Simulation Row */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder={pendingOffer ? 'Counter offer (KES)' : 'Make offer (KES)'}
              value={offerInput}
              onChange={e => setOfferInput(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none"
            />
            <button
              onClick={handleSendOffer}
              disabled={loading || !offerInput}
              className="px-3.5 py-1.5 bg-gradient-to-r from-[#ff2e93] to-[#8b5cf6] text-white rounded-xl text-xs font-bold hover:opacity-95 disabled:opacity-50 cursor-pointer"
            >
              {pendingOffer ? 'Counter' : 'Offer'}
            </button>
            <button
              onClick={handleSimulateReply}
              disabled={loading}
              className="px-2.5 py-1.5 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-[11px] font-semibold hover:bg-stone-300 transition-colors cursor-pointer flex items-center gap-1"
              title="Simulate other user's response in demo"
            >
              <Bot className="w-3 h-3 text-purple-500" />
              <span>Simulate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
