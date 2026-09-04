'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

export type Recipient = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  status: string;
  lastSeenAt?: string;
  isBlockedByYou: boolean;
  isBlockedByThem: boolean;
};

export type Conversation = {
  id: string;
  recipient: Recipient;
  lastMessage?: {
    id: string;
    content: string;
    sender_id: string;
    message_type: string;
    status: string;
    created_at: string;
  };
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  senderAvatarUrl?: string;
  messageType: string;
  content: string;
  replyToId?: string;
  replyPreview?: {
    id: string;
    content: string;
    sender_id: string;
    sender_name: string;
    sender_username: string;
  };
  status: string;
  createdAt: string;
  attachments?: { id?: string; attachment_type: string; url: string; metadata?: Record<string, unknown> }[];
  reactions?: { emoji: string; count: number; reacted_by_me: boolean }[];
  isPinned: boolean;
};

const QUICK_EMOJIS = ['❤️', '😂', '👍', '😮', '😢'];

function formatChatTime(dateString: string) {
  try {
    const d = new Date(dateString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function isUserOnline(lastSeenAt?: string) {
  if (!lastSeenAt) return false;
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  return diff < 4 * 60 * 1000; // online if seen within 4 minutes
}

export default function ChatClient({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialConvId = searchParams.get('id');
  const targetUser = searchParams.get('user');
  const shareShotId = searchParams.get('shareShotId');
  const shareShotTitle = searchParams.get('shareShotTitle');
  const shareShotImage = searchParams.get('shareShotImage');
  const shareShotAuthor = searchParams.get('shareShotAuthor');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConvId);
  const [activeConv, setActiveConv] = useState<{ recipient: Recipient; pinnedMessages: Message[] } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [composerText, setComposerText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<{ url: string; type: string } | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [statusError, setStatusError] = useState('');

  // New Chat Modal
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<{ id: string; username: string; displayName: string; avatarUrl?: string }[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Report Modal
  const [reportMsg, setReportMsg] = useState<Message | null>(null);
  const [reportCategory, setReportCategory] = useState('HARASSMENT');
  const [reportDetails, setReportDetails] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch conversations list
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chats', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch { /* ignore network error */ }
  }, []);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 8000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  // Handle targetUser query param (e.g. /chats?user=creator)
  useEffect(() => {
    if (!targetUser) return;
    async function startChatWithUser() {
      try {
        const res = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: targetUser }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.conversationId) {
            setActiveConvId(data.conversationId);
            loadConversations();
          }
        }
      } catch { /* ignore */ }
    }
    startChatWithUser();
  }, [targetUser, loadConversations]);

  // Handle shared Skillshot attachment pre-fill
  useEffect(() => {
    if (shareShotId && shareShotTitle) {
      setAttachmentPreview({
        url: shareShotImage || '',
        type: 'SKILLSHOT',
      });
      setComposerText(`Check out "${shareShotTitle}" by @${shareShotAuthor || 'creator'}`);
    }
  }, [shareShotId, shareShotTitle, shareShotImage, shareShotAuthor]);

  // Fetch active conversation detail & messages
  const loadActiveConversation = useCallback(async (convId: string) => {
    try {
      const [detailRes, msgsRes] = await Promise.all([
        fetch(`/api/chats/${convId}`, { cache: 'no-store' }),
        fetch(`/api/chats/${convId}/messages`, { cache: 'no-store' }),
      ]);

      if (detailRes.ok) {
        const detail = await detailRes.json();
        setActiveConv({
          recipient: detail.recipient,
          pinnedMessages: detail.pinnedMessages || [],
        });
      }

      if (msgsRes.ok) {
        const msgs = await msgsRes.json();
        setMessages(msgs.messages || []);
      }

      // Mark conversation as read
      await fetch(`/api/chats/${convId}/read`, { method: 'POST' });
      setConversations(prev =>
        prev.map(c => (c.id === convId ? { ...c, unreadCount: 0 } : c))
      );
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!activeConvId) {
      setActiveConv(null);
      setMessages([]);
      return;
    }
    loadActiveConversation(activeConvId);
    scrollToBottom();

    // Fast polling for active conversation
    const interval = setInterval(() => {
      loadActiveConversation(activeConvId);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeConvId, loadActiveConversation, scrollToBottom]);

  // Search users for new chat modal
  useEffect(() => {
    if (!userQuery.trim()) {
      setUserResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(userQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setUserResults(data.users || []);
        }
      } finally {
        setIsSearchingUsers(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [userQuery]);

  // Send message handler
  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!activeConvId || isSending) return;
    const text = composerText.trim();
    if (!text && !attachmentPreview) return;

    setIsSending(true);
    setStatusError('');

    try {
      const attachments = [];
      let msgType = 'TEXT';

      if (attachmentPreview) {
        msgType = attachmentPreview.type;
        attachments.push({
          attachmentType: attachmentPreview.type,
          url: attachmentPreview.url,
          metadata: attachmentPreview.type === 'SKILLSHOT'
            ? { shotId: shareShotId, title: shareShotTitle, creator: shareShotAuthor }
            : {},
        });
      }

      const res = await fetch(`/api/chats/${activeConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          messageType: msgType,
          replyToId: replyingTo?.id,
          attachments,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusError(data.error || 'Failed to send message.');
        return;
      }

      setComposerText('');
      setReplyingTo(null);
      setAttachmentPreview(null);
      setMessages(prev => [...prev, data]);
      scrollToBottom();
      loadConversations();
    } catch {
      setStatusError('Network error. Please try again.');
    } finally {
      setIsSending(false);
    }
  }

  // File upload for image/GIF in chat
  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setStatusError('File exceeds maximum size of 10 MB.');
      return;
    }

    const isGif = file.type === 'image/gif';
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      setStatusError('Only images and GIFs are supported.');
      return;
    }

    // Convert to DataURL for immediate preview and transmission
    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentPreview({
        url: reader.result as string,
        type: isGif ? 'GIF' : 'IMAGE',
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // Emoji reaction toggle
  async function handleReaction(messageId: string, emoji: string) {
    if (!activeConvId) return;
    try {
      const res = await fetch(`/api/chats/${activeConvId}/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev =>
          prev.map(m => (m.id === messageId ? { ...m, reactions: data.reactions } : m))
        );
      }
    } catch { /* ignore */ }
  }

  // Pin toggle
  async function handlePin(messageId: string) {
    if (!activeConvId) return;
    try {
      const res = await fetch(`/api/chats/${activeConvId}/messages/${messageId}/pin`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev =>
          prev.map(m => (m.id === messageId ? { ...m, isPinned: data.isPinned } : m))
        );
        loadActiveConversation(activeConvId);
      }
    } catch { /* ignore */ }
  }

  // Delete message
  async function handleDeleteMessage(messageId: string) {
    if (!activeConvId || !confirm('Delete this message?')) return;
    try {
      const res = await fetch(`/api/chats/${activeConvId}/messages/${messageId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMessages(prev =>
          prev.map(m =>
            m.id === messageId
              ? { ...m, status: 'DELETED', content: '', attachments: [] }
              : m
          )
        );
      }
    } catch { /* ignore */ }
  }

  // Block toggle
  async function handleBlockToggle() {
    if (!activeConvId || !activeConv) return;
    const isBlocking = !activeConv.recipient.isBlockedByYou;
    const confirmMsg = isBlocking
      ? `Block @${activeConv.recipient.username}? You won't be able to exchange messages.`
      : `Unblock @${activeConv.recipient.username}?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/chats/${activeConvId}/block`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setActiveConv(prev =>
          prev
            ? {
                ...prev,
                recipient: { ...prev.recipient, isBlockedByYou: data.isBlocked },
              }
            : null
        );
        loadConversations();
      }
    } catch { /* ignore */ }
  }

  // Report submit
  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!activeConvId || !reportMsg || isReporting) return;
    setIsReporting(true);
    try {
      const res = await fetch(
        `/api/chats/${activeConvId}/messages/${reportMsg.id}/report`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: reportCategory, details: reportDetails }),
        }
      );
      if (res.ok) {
        alert('Thank you. The reported message has been forwarded to moderation.');
        setReportMsg(null);
        setReportDetails('');
      } else {
        const data = await res.json();
        alert(data.error || 'Could not submit report.');
      }
    } finally {
      setIsReporting(false);
    }
  }

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.recipient.displayName.toLowerCase().includes(q) ||
      c.recipient.username.toLowerCase().includes(q)
    );
  });

  return (
    <div className="chatsWorkspace">
      {/* SIDEBAR: Conversation List */}
      <aside className={`chatsSidebar ${activeConvId ? 'mobileHidden' : ''}`}>
        <div className="chatsSidebarHeader">
          <div className="chatsSidebarTitleRow">
            <h1>Chats</h1>
            <button
              type="button"
              className="newChatBtn"
              onClick={() => setIsNewChatOpen(true)}
              aria-label="Start new chat"
            >
              ＋ New chat
            </button>
          </div>
          <input
            type="search"
            className="chatSearchInput"
            placeholder="Search conversations…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <ul className="conversationList" aria-label="Conversations">
          {filteredConversations.length === 0 ? (
            <li className="chatMainEmpty" style={{ padding: '24px 16px' }}>
              <p>No conversations found.</p>
              <button
                type="button"
                className="newChatBtn"
                onClick={() => setIsNewChatOpen(true)}
                style={{ marginTop: '8px' }}
              >
                Find creators
              </button>
            </li>
          ) : (
            filteredConversations.map(conv => {
              const isOnline = isUserOnline(conv.recipient.lastSeenAt);
              const isActive = conv.id === activeConvId;
              const hasUnread = conv.unreadCount > 0;
              const snippet = conv.lastMessage
                ? conv.lastMessage.status === 'DELETED'
                  ? 'Message deleted'
                  : conv.lastMessage.content || `Attachment [${conv.lastMessage.message_type}]`
                : 'No messages yet';

              return (
                <li
                  key={conv.id}
                  className={`convItem ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActiveConvId(conv.id);
                    router.replace(`/chats?id=${conv.id}`);
                  }}
                >
                  <div className="convAvatarWrap">
                    {conv.recipient.avatarUrl ? (
                      <img
                        src={conv.recipient.avatarUrl}
                        alt=""
                        className="convAvatar"
                      />
                    ) : (
                      <div className="convAvatar">
                        {conv.recipient.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    {isOnline && <span className="onlineDot" title="Online" />}
                  </div>

                  <div className="convInfo">
                    <div className="convTopRow">
                      <span className="convName">{conv.recipient.displayName}</span>
                      {conv.lastMessage && (
                        <span className="convTime">
                          {formatChatTime(conv.lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="convBottomRow">
                      <span className={`convSnippet ${hasUnread ? 'unread' : ''}`}>
                        {conv.lastMessage?.sender_id === currentUserId ? 'You: ' : ''}
                        {snippet}
                      </span>
                      {hasUnread && <span className="convBadge">{conv.unreadCount}</span>}
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      {/* MAIN: Active Conversation */}
      <main className={`chatsMain ${!activeConvId ? 'mobileHidden' : ''}`}>
        {!activeConvId || !activeConv ? (
          <div className="chatMainEmpty">
            <span style={{ fontSize: '36px' }} aria-hidden="true">💬</span>
            <h2>Your Messages</h2>
            <p>Select a conversation or start a new chat with another creator.</p>
            <button
              type="button"
              className="newChatBtn"
              onClick={() => setIsNewChatOpen(true)}
              style={{ marginTop: '12px' }}
            >
              ＋ Start a conversation
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="chatHeader">
              <div className="chatHeaderUser">
                <button
                  type="button"
                  className="chatBackBtn"
                  onClick={() => {
                    setActiveConvId(null);
                    router.replace('/chats');
                  }}
                  aria-label="Back to conversations"
                >
                  ←
                </button>
                <Link
                  href={`/users/${activeConv.recipient.username}`}
                  style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <div className="convAvatarWrap" style={{ width: '38px', height: '38px' }}>
                    {activeConv.recipient.avatarUrl ? (
                      <img src={activeConv.recipient.avatarUrl} alt="" className="convAvatar" />
                    ) : (
                      <div className="convAvatar">
                        {activeConv.recipient.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    {isUserOnline(activeConv.recipient.lastSeenAt) && (
                      <span className="onlineDot" title="Online" />
                    )}
                  </div>
                  <div className="chatHeaderDetails">
                    <h2>{activeConv.recipient.displayName}</h2>
                    <p>
                      @{activeConv.recipient.username} ·{' '}
                      {isUserOnline(activeConv.recipient.lastSeenAt) ? '● Online' : 'Active recently'}
                    </p>
                  </div>
                </Link>
              </div>

              <div className="chatHeaderActions">
                {activeConv.pinnedMessages.length > 0 && (
                  <button
                    type="button"
                    className="chatHeaderActionBtn"
                    onClick={() => setShowPinned(v => !v)}
                  >
                    📌 {activeConv.pinnedMessages.length} Pinned
                  </button>
                )}
                <button
                  type="button"
                  className={`chatHeaderActionBtn ${activeConv.recipient.isBlockedByYou ? 'danger' : ''}`}
                  onClick={handleBlockToggle}
                >
                  {activeConv.recipient.isBlockedByYou ? 'Unblock' : 'Block'}
                </button>
              </div>
            </header>

            {/* Pinned Messages Bar */}
            {showPinned && activeConv.pinnedMessages.length > 0 && (
              <div className="pinnedBar">
                <span>📌 Pinned ({activeConv.pinnedMessages.length}):</span>
                <div>
                  {activeConv.pinnedMessages.map(pm => (
                    <span key={pm.id} style={{ marginLeft: '12px', fontSize: '12px' }}>
                      "{pm.content.slice(0, 30)}…"
                    </span>
                  ))}
                </div>
                <button type="button" onClick={() => setShowPinned(false)}>Close</button>
              </div>
            )}

            {/* Messages Stream */}
            <div className="messagesStream" tabIndex={0} aria-label="Messages history">
              {messages.map(msg => {
                const isMe = msg.senderId === currentUserId;
                const isDeleted = msg.status === 'DELETED';

                return (
                  <div
                    key={msg.id}
                    className={`messageRow ${isMe ? 'sent' : 'received'}`}
                  >
                    {!isMe && (
                      <span className="messageSenderLabel">
                        {msg.senderName || `@${msg.senderUsername}`}
                      </span>
                    )}

                    {/* Quoted reply preview */}
                    {msg.replyPreview && (
                      <div className="replyChip">
                        ↩️ @{msg.replyPreview.sender_username}: {msg.replyPreview.content.slice(0, 50)}
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`messageBubble ${isDeleted ? 'deleted' : ''}`}>
                      {isDeleted ? (
                        'Message deleted'
                      ) : (
                        <>
                          {msg.content && <p style={{ margin: 0 }}>{msg.content}</p>}

                          {/* Image / GIF attachment */}
                          {msg.attachments?.map((att, idx) => (
                            <div key={idx}>
                              {att.attachment_type === 'SKILLSHOT' ? (
                                <div className="sharedShotCard">
                                  {att.url && (
                                    <img src={att.url} alt="" className="sharedShotThumb" />
                                  )}
                                  <div className="sharedShotBody">
                                    <h4>{String(att.metadata?.title || 'Shared Skillshot')}</h4>
                                    <p>by @{String(att.metadata?.creator || 'creator')}</p>
                                    <Link
                                      href={`/shots/${att.metadata?.shotId || ''}`}
                                      className="sharedShotLink"
                                    >
                                      View Skillshot →
                                    </Link>
                                  </div>
                                </div>
                              ) : (
                                <img
                                  src={att.url}
                                  alt="Attachment"
                                  className="msgImageAttachment"
                                  onClick={() => window.open(att.url, '_blank')}
                                />
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="messageMeta">
                      <span>{formatChatTime(msg.createdAt)}</span>
                      {msg.isPinned && <span title="Pinned message">📌</span>}
                    </div>

                    {/* Reactions Pill Row */}
                    {!isDeleted && msg.reactions && msg.reactions.length > 0 && (
                      <div className="reactionsRow">
                        {msg.reactions.map(r => (
                          <button
                            type="button"
                            key={r.emoji}
                            className={`reactionPill ${r.reacted_by_me ? 'reactedByMe' : ''}`}
                            onClick={() => handleReaction(msg.id, r.emoji)}
                            title={`React with ${r.emoji}`}
                          >
                            <span>{r.emoji}</span>
                            <span>{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Hover Action Toolbar */}
                    {!isDeleted && (
                      <div className="msgHoverActions">
                        {QUICK_EMOJIS.slice(0, 3).map(e => (
                          <button
                            key={e}
                            type="button"
                            className="msgActionBtn"
                            onClick={() => handleReaction(msg.id, e)}
                          >
                            {e}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="msgActionBtn"
                          onClick={() => setReplyingTo(msg)}
                          title="Reply"
                        >
                          ↩️
                        </button>
                        <button
                          type="button"
                          className="msgActionBtn"
                          onClick={() => handlePin(msg.id)}
                          title="Pin message"
                        >
                          📌
                        </button>
                        {isMe ? (
                          <button
                            type="button"
                            className="msgActionBtn"
                            onClick={() => handleDeleteMessage(msg.id)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="msgActionBtn"
                            onClick={() => setReportMsg(msg)}
                            title="Report"
                          >
                            🚩
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Blocked State Notice */}
            {activeConv.recipient.isBlockedByYou ? (
              <div className="blockedBanner">
                <span>You blocked this user.</span>
                <button
                  type="button"
                  className="chatHeaderActionBtn"
                  onClick={handleBlockToggle}
                >
                  Unblock
                </button>
              </div>
            ) : activeConv.recipient.isBlockedByThem ? (
              <div className="blockedBanner">
                <span>You cannot reply to this conversation.</span>
              </div>
            ) : (
              /* Composer */
              <form className="chatComposer" onSubmit={handleSendMessage}>
                {statusError && (
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--danger)' }}>
                    {statusError}
                  </p>
                )}

                {/* Quoted reply context */}
                {replyingTo && (
                  <div className="composerReplyPreview">
                    <span>
                      Replying to @{replyingTo.senderUsername}: "{replyingTo.content.slice(0, 40)}…"
                    </span>
                    <button type="button" onClick={() => setReplyingTo(null)}>✕</button>
                  </div>
                )}

                {/* Attachment preview */}
                {attachmentPreview && (
                  <div className="composerAttachmentPreview">
                    <img src={attachmentPreview.url} alt="Upload preview" />
                    <span style={{ fontSize: '12px' }}>{attachmentPreview.type} attachment</span>
                    <button
                      type="button"
                      onClick={() => setAttachmentPreview(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="composerInputRow">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    className="composerAttachBtn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach image or GIF"
                    aria-label="Attach file"
                  >
                    ＋
                  </button>

                  <textarea
                    className="composerTextarea"
                    placeholder="Type a message…"
                    value={composerText}
                    onChange={e => setComposerText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    rows={1}
                  />

                  <button
                    type="submit"
                    className="composerSendBtn"
                    disabled={isSending || (!composerText.trim() && !attachmentPreview)}
                  >
                    {isSending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </main>

      {/* NEW CHAT MODAL */}
      {isNewChatOpen && (
        <div className="chatModalOverlay" onClick={() => setIsNewChatOpen(false)}>
          <div className="chatModal" onClick={e => e.stopPropagation()}>
            <div className="chatModalHeader">
              <h3>Start a Conversation</h3>
              <button
                type="button"
                className="chatModalClose"
                onClick={() => setIsNewChatOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="chatModalBody">
              <input
                type="search"
                className="chatSearchInput"
                placeholder="Search creators by name or username…"
                value={userQuery}
                onChange={e => setUserQuery(e.target.value)}
                autoFocus
              />

              {isSearchingUsers && <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Searching…</p>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {userResults.map(u => (
                  <div
                    key={u.id}
                    className="userSearchResultItem"
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/chats', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ recipientId: u.id }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setIsNewChatOpen(false);
                          setActiveConvId(data.conversationId);
                          loadConversations();
                        }
                      } catch { /* ignore */ }
                    }}
                  >
                    <div className="convAvatarWrap" style={{ width: '32px', height: '32px' }}>
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="convAvatar" />
                      ) : (
                        <div className="convAvatar">{u.displayName.slice(0, 1).toUpperCase()}</div>
                      )}
                    </div>
                    <div>
                      <strong style={{ fontSize: '13.5px', color: 'var(--ink)' }}>{u.displayName}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>@{u.username}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORT MESSAGE MODAL */}
      {reportMsg && (
        <div className="chatModalOverlay" onClick={() => setReportMsg(null)}>
          <div className="chatModal" onClick={e => e.stopPropagation()}>
            <div className="chatModalHeader">
              <h3>Report Message</h3>
              <button type="button" className="chatModalClose" onClick={() => setReportMsg(null)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitReport} className="chatModalBody">
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                Report content from @{reportMsg.senderUsername}: "{reportMsg.content.slice(0, 60)}…"
              </p>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>
                Reason
                <select
                  className="chatSearchInput"
                  value={reportCategory}
                  onChange={e => setReportCategory(e.target.value)}
                  style={{ marginTop: '4px' }}
                >
                  <option value="HARASSMENT">Harassment or bullying</option>
                  <option value="HATE">Hate speech or abuse</option>
                  <option value="SPAM">Spam or unwanted advertising</option>
                  <option value="SEXUAL">Sexual or inappropriate content</option>
                  <option value="VIOLENCE">Violence or threats</option>
                  <option value="SCAM">Scam or phishing</option>
                  <option value="OTHER">Other violation</option>
                </select>
              </label>

              <label style={{ fontSize: '13px', fontWeight: 600 }}>
                Additional Details (optional)
                <textarea
                  className="chatSearchInput"
                  rows={3}
                  value={reportDetails}
                  onChange={e => setReportDetails(e.target.value)}
                  placeholder="Explain what is violating guidelines…"
                  style={{ marginTop: '4px', resize: 'vertical' }}
                />
              </label>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  className="chatHeaderActionBtn"
                  onClick={() => setReportMsg(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="composerSendBtn"
                  disabled={isReporting}
                >
                  {isReporting ? 'Submitting…' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
