import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, Radio } from 'lucide-react';
import type { ChatMessage } from '../../lib/chatTypes';
import { messageType } from '../../lib/chatTypes';

const Spinner = () => (
  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
);

type ChatPanelProps = {
  messages: ChatMessage[];
  currentUserId: string;
  title: string;
  subtitle?: string;
  connected?: boolean;
  onSend: (text: string) => void | Promise<void>;
  sending?: boolean;
  placeholder?: string;
  emptyHint?: string;
  className?: string;
  /** Employer-only: message category */
  msgType?: string;
  onMsgTypeChange?: (t: string) => void;
  showMsgTypeSelect?: boolean;
  compact?: boolean;
};

function initials(name: string) {
  const p = name.trim().split(/\s+/).slice(0, 2);
  return p.map(s => s[0]).join('').toUpperCase() || '?';
}

export function ChatPanel({
  messages,
  currentUserId,
  title,
  subtitle,
  connected = true,
  onSend,
  sending = false,
  placeholder = 'Type a message…',
  emptyHint = 'No messages yet. Start the conversation.',
  className = '',
  msgType = 'message',
  onMsgTypeChange,
  showMsgTypeSelect = false,
  compact = false,
}: ChatPanelProps) {
  const [draft, setDraft] = React.useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages]);

  const submit = async () => {
    const t = draft.trim();
    if (!t || sending) return;
    setDraft('');
    await onSend(t);
  };

  const bubbleKind = (m: ChatMessage) => {
    const mt = messageType(m);
    if (mt === 'rejection') return 'destructive';
    if (mt === 'offer') return 'offer';
    if (mt === 'feedback') return 'feedback';
    return 'default';
  };

  return (
    <div
      className={`flex flex-col min-h-0 rounded-2xl border border-border/80 bg-gradient-to-b from-card/90 to-card/50 backdrop-blur-md shadow-xl overflow-hidden ${className}`}
    >
      <div className={`shrink-0 border-b border-border/60 bg-black/20 ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className={`font-bold text-white truncate ${compact ? 'text-xs' : 'text-sm'}`}>{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{subtitle}</p>}
          </div>
          <div
            className={`flex items-center gap-1.5 shrink-0 text-[10px] uppercase tracking-wider font-semibold ${
              connected ? 'text-emerald-400/90' : 'text-muted-foreground'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${connected ? 'animate-pulse' : ''}`} />
            {connected ? 'Live' : '…'}
          </div>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto min-h-0 space-y-3 ${compact ? 'p-3' : 'p-4'}`}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <MessageCircle className="w-10 h-10 mb-3 opacity-40" />
            <p className={`${compact ? 'text-xs' : 'text-sm'}`}>{emptyHint}</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map(m => {
            const mine = m.from_id === currentUserId;
            const mt = messageType(m);
            const kind = bubbleKind(m);
            const border =
              kind === 'destructive'
                ? 'border-destructive/25'
                : kind === 'offer'
                  ? 'border-primary/30'
                  : kind === 'feedback'
                    ? 'border-secondary/25'
                    : 'border-border/60';
            const bg = mine
              ? 'bg-secondary/25 border-secondary/40'
              : kind === 'destructive'
                ? 'bg-destructive/10'
                : kind === 'offer'
                  ? 'bg-primary/10'
                  : kind === 'feedback'
                    ? 'bg-secondary/10'
                    : 'bg-background/40';

            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className={`flex gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    mine ? 'bg-secondary/40 text-white' : 'bg-white/10 text-white/90'
                  }`}
                >
                  {initials(m.from_name || '?')}
                </div>
                <div className={`max-w-[min(100%,28rem)] min-w-0 ${mine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 border shadow-sm ${border} ${bg} ${
                      mine ? 'rounded-tr-sm' : 'rounded-tl-sm'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`font-semibold text-white/95 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                        {mine ? 'You' : m.from_name}
                      </span>
                      {mt !== 'message' && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                            kind === 'destructive'
                              ? 'border-destructive/40 text-destructive'
                              : kind === 'offer'
                                ? 'border-primary/40 text-primary'
                                : 'border-secondary/40 text-secondary'
                          }`}
                        >
                          {mt}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {m.timestamp ? new Date(m.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className={`text-white/90 whitespace-pre-wrap break-words leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
                      {m.content}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <div className={`shrink-0 border-t border-border/60 bg-black/15 ${compact ? 'p-2.5' : 'p-3'}`}>
        {showMsgTypeSelect && onMsgTypeChange && (
          <div className="mb-2 flex gap-2">
            <select
              className="bg-background/50 border border-border text-white px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:border-secondary"
              value={msgType}
              onChange={e => onMsgTypeChange(e.target.value)}
            >
              <option value="message">Message</option>
              <option value="feedback">Feedback</option>
              <option value="offer">Offer</option>
            </select>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            rows={compact ? 2 : 3}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            className={`flex-1 w-full bg-background/50 border border-border text-white rounded-xl focus:outline-none focus:border-secondary/80 resize-none placeholder:text-muted-foreground ${
              compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm'
            }`}
          />
          <button
            type="button"
            onClick={() => submit()}
            disabled={sending || !draft.trim()}
            className="shrink-0 h-11 w-11 rounded-xl bg-secondary hover:bg-secondary/85 disabled:opacity-45 disabled:cursor-not-allowed text-white flex items-center justify-center transition shadow-lg shadow-secondary/20"
            aria-label="Send"
          >
            {sending ? <Spinner /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
