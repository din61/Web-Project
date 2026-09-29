import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

const CONVERSATIONS_POLL_MS = 6000;
const MESSAGES_POLL_MS = 2500;

function timeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

export default function Chat() {
  const { user } = useAuth();
  const toast = useToast();
  const otherRoleLabel = user?.role === 'student' ? 'Teacher' : 'Student';

  const [conversations, setConversations] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contacts, setContacts] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const bottomRef = useRef(null);
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedId;

  const loadConversations = useCallback(() => {
    ChatApi.conversations()
      .then((res) => setConversations(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadConversations();
    const id = setInterval(loadConversations, CONVERSATIONS_POLL_MS);
    return () => clearInterval(id);
  }, [loadConversations]);

  const loadMessages = useCallback((conversationId, { showLoading = false } = {}) => {
    if (!conversationId) return;
    if (showLoading) setMessagesLoading(true);
    ChatApi.messages(conversationId)
      .then((res) => {
        if (selectedIdRef.current !== conversationId) return;
        setMessages(res.data.messages);
      })
      .catch(() => {})
      .finally(() => {
        if (showLoading) setMessagesLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId, { showLoading: true });
    const id = setInterval(() => loadMessages(selectedId), MESSAGES_POLL_MS);
    return () => clearInterval(id);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const openContacts = () => {
    setContactsOpen(true);
    if (!contacts) {
      ChatApi.contacts()
        .then((res) => setContacts(res.data))
        .catch((err) => toast.error(err.message));
    }
  };

  const selectConversation = (conv) => {
    setSelectedId(conv.id);
    setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c)));
  };

  const startChat = async (contact) => {
    try {
      const res = await ChatApi.startConversation(contact.id);
      const conv = res.data;
      setConversations((prev) => {
        const exists = prev?.some((c) => c.id === conv.id);
        return exists ? prev : [conv, ...(prev || [])];
      });
      setContactsOpen(false);
      setSelectedId(conv.id);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !selectedId) return;
    setSending(true);
    try {
      const res = await ChatApi.sendMessage(selectedId, trimmed);
      setMessages((prev) => [...prev, res.data]);
      setText('');
      loadConversations();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const selectedConversation = useMemo(
    () => conversations?.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-slate-100">Messages</h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">
          Chat directly with your {otherRoleLabel.toLowerCase()}s.
        </p>
      </div>

      <div className="flex h-[calc(100vh-220px)] min-h-[480px] overflow-hidden rounded-card border border-border bg-surface shadow-soft dark:border-slate-700 dark:bg-slate-800">
        <div className="flex w-full max-w-xs shrink-0 flex-col border-r border-border dark:border-slate-700">
          <div className="flex items-center justify-between border-b border-border p-3 dark:border-slate-700">
            <p className="px-1 text-sm font-semibold text-text dark:text-slate-100">Conversations</p>
            <Button size="sm" icon="add" onClick={openContacts}>New</Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations === null ? (
              <LoadingState label="Loading conversations..." />
            ) : conversations.length === 0 ? (
              <EmptyState icon="chat" message={`No conversations yet. Start one with a ${otherRoleLabel.toLowerCase()}.`} />
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectConversation(c)}
                  className={`flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors last:border-0 dark:border-slate-700 ${
                    selectedId === c.id ? 'bg-primary/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {initials(c.contactName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-text dark:text-slate-100">{c.contactName}</p>
                      {c.lastMessageAt && (
                        <span className="shrink-0 text-[11px] text-text-secondary dark:text-slate-400">{timeLabel(c.lastMessageAt)}</span>
                      )}
                    </div>
                    <p className="truncate text-xs text-text-secondary dark:text-slate-400">
                      {c.lastMessageText || 'No messages yet'}
                    </p>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">
                      {c.unreadCount}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {!selectedConversation ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState icon="forum" message="Select a conversation to start chatting." />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-border p-3 dark:border-slate-700">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {initials(selectedConversation.contactName)}
                </div>
                <p className="font-medium text-text dark:text-slate-100">{selectedConversation.contactName}</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {messagesLoading && messages.length === 0 ? (
                  <LoadingState label="Loading messages..." />
                ) : messages.length === 0 ? (
                  <EmptyState icon="waving_hand" message="Say hello — no messages yet in this conversation." />
                ) : (
                  <div className="flex flex-col gap-2">
                    {messages.map((m) => {
                      const mine = m.senderRole === user?.role;
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                              mine
                                ? 'rounded-br-sm bg-primary text-white'
                                : 'rounded-bl-sm bg-slate-100 text-text dark:bg-slate-700 dark:text-slate-100'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{m.text}</p>
                            <p className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-text-secondary dark:text-slate-400'}`}>
                              {timeLabel(m.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3 dark:border-slate-700">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-btn border border-border bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
                <Button type="submit" icon="send" loading={sending} disabled={!text.trim()}>Send</Button>
              </form>
            </>
          )}
        </div>
      </div>

      <Modal open={contactsOpen} onClose={() => setContactsOpen(false)} title={`Message a ${otherRoleLabel}`}>
        {contacts === null ? (
          <LoadingState label="Loading contacts..." />
        ) : contacts.length === 0 ? (
          <EmptyState icon="person_off" message={`No ${otherRoleLabel.toLowerCase()}s available to message yet.`} />
        ) : (
          <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
            {contacts.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => startChat(c)}
                  className="flex w-full items-center gap-3 rounded-btn px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text dark:text-slate-100">{c.name}</p>
                    <p className="truncate text-xs text-text-secondary dark:text-slate-400">{c.subtitle}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
