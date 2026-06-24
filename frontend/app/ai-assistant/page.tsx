"use client";

import {
  Bot,
  Check,
  Copy,
  Download,
  Loader2,
  Mic,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Trash,
  User as UserIcon,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import CommandSidebar from "@/components/shell/CommandSidebar";
import { useToast } from "@/components/ui/Toast";
import { LANGUAGE_LIST, t, type LangCode } from "@/lib/languages";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { getAIStatus, streamChat, translateText } from "@/services/aiApi";
import {
  bulkDeleteConversations,
  createConversation,
  deleteAllConversations,
  deleteConversation,
  getConversation,
  listConversations,
  pinConversation,
  renameConversation
} from "@/services/chatApi";
import type { ChatMessageRow, ConversationSummary } from "@/types/chat";

const FALLBACK_SUGGESTIONS = [
  "Summarize FIR/2026/05/0000007 and recommend next actions",
  "What evidence is missing in this case?",
  "What cases is a suspect connected to?",
  "Show recent cases in Mysuru district"
];

interface LocalMessage extends ChatMessageRow {}

export default function AIAssistantPage() {
  const toast = useToast();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingConvos, setIsLoadingConvos] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_SUGGESTIONS);
  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [language, setLanguage] = useState<LangCode>("en");
  const [voiceOutput, setVoiceOutput] = useState(false);
  const [translateNote, setTranslateNote] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | "all" | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const localIdRef = useRef(-1); // negative ids for optimistic local messages

  const speech = useSpeechRecognition();
  const tts = useSpeechSynthesis();

  useEffect(() => {
    if (speech.transcript) setInput(speech.transcript);
  }, [speech.transcript]);

  // Load conversations + AI status on mount.
  const refreshConversations = useCallback(
    async (searchTerm?: string) => {
      const data = await listConversations(searchTerm).catch(() => []);
      setConversations(data);
      return data;
    },
    []
  );

  useEffect(() => {
    void (async () => {
      const data = await refreshConversations();
      if (data.length) {
        setActiveId(data[0].id);
      }
      setIsLoadingConvos(false);
    })();

    void getAIStatus()
      .then((status) => {
        setIsLive(status.live);
        if (status.suggested_questions?.length) setSuggestions(status.suggested_questions);
      })
      .catch(() => setIsLive(false));
  }, [refreshConversations]);

  // Debounced search.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshConversations(search.trim() || undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, refreshConversations]);

  // Load messages when active conversation changes.
  useEffect(() => {
    if (activeId == null) {
      setMessages([]);
      return;
    }
    void getConversation(activeId)
      .then((detail) => setMessages(detail.messages))
      .catch(() => setMessages([]));
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  const handleNewConversation = useCallback(async () => {
    const conv = await createConversation().catch(() => null);
    if (!conv) {
      toast.notify("Could not start a new chat.", "error");
      return null;
    }
    await refreshConversations(search.trim() || undefined);
    setActiveId(conv.id);
    setMessages([]);
    return conv.id;
  }, [refreshConversations, search, toast]);

  const handleSend = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || isStreaming) return;

      // Ensure a server conversation exists.
      let convId = activeId;
      if (convId == null) {
        convId = await handleNewConversation();
        if (convId == null) return;
      }

      const userMsg: LocalMessage = {
        id: localIdRef.current--,
        role: "user",
        content: message,
        created_at: new Date().toISOString()
      };
      const assistantMsg: LocalMessage = {
        id: localIdRef.current--,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString()
      };
      setMessages((m) => [...m, userMsg, assistantMsg]);

      setInput("");
      setIsStreaming(true);
      setTranslateNote("");
      abortRef.current = new AbortController();

      const setAssistant = (content: string) =>
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") next[next.length - 1] = { ...last, content };
          return next;
        });

      try {
        let queryForAi = message;
        if (language !== "en") {
          const inbound = await translateText(message, "en", language);
          queryForAi = inbound.text;
          if (!inbound.translated && inbound.note) setTranslateNote(inbound.note);
        }

        let englishAnswer = "";
        await streamChat(queryForAi, {
          conversationId: convId,
          signal: abortRef.current.signal,
          onChunk: (chunk) => {
            englishAnswer += chunk;
            setAssistant(englishAnswer);
          }
        });

        let finalAnswer = englishAnswer;
        if (language !== "en" && englishAnswer.trim()) {
          const outbound = await translateText(englishAnswer, language, "en");
          finalAnswer = outbound.text;
          if (!outbound.translated && outbound.note) setTranslateNote(outbound.note);
          setAssistant(finalAnswer);
        }
        if (voiceOutput && finalAnswer.trim()) tts.speak(finalAnswer, language);

        // Refresh sidebar (title auto-set server-side, updated_at bumped).
        void refreshConversations(search.trim() || undefined);
      } catch {
        setAssistant("⚠️ The AI request failed. Please try again.");
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [activeId, handleNewConversation, isStreaming, language, voiceOutput, tts, refreshConversations, search]
  );

  const handleCopy = async (m: LocalMessage) => {
    await navigator.clipboard.writeText(m.content);
    setCopiedId(m.id);
    window.setTimeout(() => setCopiedId(null), 1500);
  };

  const handleRename = async (id: number) => {
    const title = renameValue.trim();
    if (!title) return;
    await renameConversation(id, title).catch(() => null);
    setRenamingId(null);
    await refreshConversations(search.trim() || undefined);
    toast.notify("Conversation renamed.", "success");
  };

  const handleTogglePin = async (conv: ConversationSummary) => {
    await pinConversation(conv.id, !conv.pinned).catch(() => null);
    await refreshConversations(search.trim() || undefined);
  };

  const confirmDelete = async () => {
    if (deleteTarget == null) return;
    if (deleteTarget === "all") {
      await deleteAllConversations().catch(() => null);
      setActiveId(null);
      setMessages([]);
      toast.notify("All conversations deleted.", "success");
    } else {
      await deleteConversation(deleteTarget.id).catch(() => null);
      if (deleteTarget.id === activeId) {
        setActiveId(null);
        setMessages([]);
      }
      toast.notify("Conversation deleted.", "success");
    }
    setDeleteTarget(null);
    await refreshConversations(search.trim() || undefined);
  };

  const handleExport = (format: "txt" | "pdf") => {
    if (!messages.length) return;
    const title = activeConversation?.title ?? "conversation";
    if (format === "txt") {
      const body = messages
        .map((m) => `${m.role === "user" ? "Officer" : "AI Assistant"}:\n${m.content}\n`)
        .join("\n");
      const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
      triggerDownload(blob, `${title}.txt`);
    } else {
      // Print-to-PDF via a new window (dependency-free).
      const win = window.open("", "_blank");
      if (!win) return;
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const rows = messages
        .map(
          (m) =>
            `<div class="msg ${m.role}"><div class="who">${m.role === "user" ? "Officer" : "AI Assistant"}</div><div class="c">${esc(m.content)}</div></div>`
        )
        .join("");
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
        <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:18px}
        .msg{margin:0 0 14px;padding:10px 12px;border-radius:8px}.user{background:#e0f2f1}.assistant{background:#f3f4f6}
        .who{font-size:11px;font-weight:700;color:#555;margin-bottom:4px}.c{white-space:pre-wrap;font-size:13px}</style>
        </head><body><h1>${esc(title)}</h1>${rows}<script>window.onload=()=>window.print()</script></body></html>`);
      win.document.close();
    }
  };

  return (
    <ProtectedRoute allowedRoles={["SuperAdmin", "StateAdmin", "DistrictAdmin", "Investigator"]}>
      <div className="bg-grid flex h-screen overflow-hidden">
        <CommandSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((c) => !c)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex flex-1 overflow-hidden">
            {/* Conversation history */}
            <aside className="glass-strong hidden w-72 shrink-0 flex-col border-r border-white/5 p-3 lg:flex">
              <button
                type="button"
                onClick={() => void handleNewConversation()}
                className="mb-3 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-600 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_-6px_rgba(34,211,238,0.6)]"
              >
                <Plus className="h-4 w-4" />
                New chat
              </button>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search chats…"
                  className="h-9 w-full rounded-lg border border-white/10 bg-black/30 pl-8 pr-3 text-sm text-zinc-200 outline-none focus:border-teal-500/40"
                />
              </div>

              <div className="flex-1 overflow-y-auto">
                {isLoadingConvos ? (
                  <div className="grid gap-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="skeleton h-9 rounded-lg" />
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="px-2 py-8 text-center text-xs text-zinc-600">
                    No conversations yet.
                  </p>
                ) : (
                  <ConversationList
                    conversations={conversations}
                    activeId={activeId}
                    renamingId={renamingId}
                    renameValue={renameValue}
                    onSelect={setActiveId}
                    onStartRename={(c) => {
                      setRenamingId(c.id);
                      setRenameValue(c.title);
                    }}
                    onRenameChange={setRenameValue}
                    onRenameCommit={handleRename}
                    onRenameCancel={() => setRenamingId(null)}
                    onTogglePin={handleTogglePin}
                    onDelete={(c) => setDeleteTarget(c)}
                  />
                )}
              </div>

              {conversations.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setDeleteTarget("all")}
                  className="mt-2 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 text-xs font-medium text-zinc-500 transition hover:border-red-500/30 hover:text-red-300"
                >
                  <Trash className="h-3.5 w-3.5" />
                  Delete all
                </button>
              ) : null}
            </aside>

            {/* Chat area */}
            <div className="flex flex-1 flex-col">
              <header className="glass-strong flex items-center justify-between border-b border-white/5 px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-teal-600/20 text-teal-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="text-sm font-semibold text-zinc-100">
                      {activeConversation?.title ?? "AI Investigation Assistant"}
                    </h1>
                    <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <Shield className="h-3 w-3" />
                      Read-only · Groq
                      {isLive === false ? (
                        <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-400">mock mode</span>
                      ) : isLive ? (
                        <span className="ml-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-400">live</span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex overflow-hidden rounded-md border border-zinc-700">
                    {LANGUAGE_LIST.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setLanguage(lang.code)}
                        className={`px-2.5 py-1.5 text-xs font-medium transition ${
                          language === lang.code ? "bg-teal-700 text-white" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                        }`}
                        title={lang.label}
                      >
                        {lang.nativeLabel}
                      </button>
                    ))}
                  </div>
                  {tts.supported ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (tts.speaking) tts.cancel();
                        setVoiceOutput((v) => !v);
                      }}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition ${
                        voiceOutput ? "border-teal-600 bg-teal-600/20 text-teal-300" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                      }`}
                      title={t(language, "speak")}
                    >
                      {voiceOutput ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </button>
                  ) : null}
                  <div className="flex overflow-hidden rounded-md border border-zinc-700">
                    <button
                      type="button"
                      onClick={() => handleExport("txt")}
                      disabled={!messages.length}
                      className="px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
                    >
                      TXT
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport("pdf")}
                      disabled={!messages.length}
                      className="border-l border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
                    >
                      PDF
                    </button>
                  </div>
                </div>
              </header>

              {translateNote ? (
                <div className="border-b border-amber-900/50 bg-amber-950/30 px-5 py-1.5 text-xs text-amber-300">
                  {translateNote}
                </div>
              ) : null}

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
                <div className="mx-auto max-w-3xl">
                  {messages.length > 0 ? (
                    <div className="grid gap-5">
                      {messages.map((m, index) => (
                        <MessageBubble
                          key={m.id}
                          message={m}
                          copied={copiedId === m.id}
                          onCopy={() => void handleCopy(m)}
                          streaming={isStreaming && m.role === "assistant" && index === messages.length - 1}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState suggestions={suggestions} onPick={(text) => void handleSend(text)} />
                  )}
                </div>
              </div>

              {/* Composer */}
              <div className="glass-strong border-t border-white/5 px-4 py-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSend(input);
                  }}
                  className="mx-auto flex max-w-3xl items-end gap-2"
                >
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend(input);
                      }
                    }}
                    rows={1}
                    placeholder={speech.listening ? t(language, "listening") : t(language, "placeholder")}
                    className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-teal-500/40 focus:ring-2 focus:ring-teal-500/15"
                  />
                  {speech.supported ? (
                    <button
                      type="button"
                      onClick={() => (speech.listening ? speech.stop() : speech.start(language))}
                      disabled={isStreaming}
                      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition disabled:opacity-50 ${
                        speech.listening ? "animate-pulse border-red-600 bg-red-600/20 text-red-300" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      }`}
                      title={t(language, "voiceInput")}
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    disabled={isStreaming || !input.trim()}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Send"
                  >
                    {isStreaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </form>
                <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-zinc-600">
                  AI assistance only — verify findings against source records. Every query is audit-logged.
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget != null ? (
        <DeleteModal
          target={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </ProtectedRoute>
  );
}

function ConversationList({
  conversations,
  activeId,
  renamingId,
  renameValue,
  onSelect,
  onStartRename,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onTogglePin,
  onDelete
}: {
  conversations: ConversationSummary[];
  activeId: number | null;
  renamingId: number | null;
  renameValue: string;
  onSelect: (id: number) => void;
  onStartRename: (c: ConversationSummary) => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: (id: number) => void;
  onRenameCancel: () => void;
  onTogglePin: (c: ConversationSummary) => void;
  onDelete: (c: ConversationSummary) => void;
}) {
  const pinned = conversations.filter((c) => c.pinned);
  const rest = conversations.filter((c) => !c.pinned);

  const renderItem = (c: ConversationSummary) => (
    <div
      key={c.id}
      className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-sm transition ${
        c.id === activeId ? "bg-teal-500/10 text-teal-200" : "text-zinc-400 hover:bg-white/5"
      }`}
    >
      {renamingId === c.id ? (
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRenameCommit(c.id);
            if (e.key === "Escape") onRenameCancel();
          }}
          onBlur={() => onRenameCommit(c.id)}
          className="h-7 w-full rounded border border-teal-500/40 bg-black/40 px-2 text-sm text-zinc-100 outline-none"
        />
      ) : (
        <>
          <button type="button" onClick={() => onSelect(c.id)} className="min-w-0 flex-1 truncate text-left">
            {c.pinned ? <Pin className="mr-1 inline h-3 w-3 text-teal-400" /> : null}
            {c.title}
          </button>
          <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <IconBtn title="Pin" onClick={() => onTogglePin(c)}>
              {c.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </IconBtn>
            <IconBtn title="Rename" onClick={() => onStartRename(c)}>
              <Pencil className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title="Delete" danger onClick={() => onDelete(c)}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="grid gap-0.5">
      {pinned.length > 0 ? (
        <>
          <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">Pinned</p>
          {pinned.map(renderItem)}
          <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">Recent</p>
        </>
      ) : null}
      {rest.map(renderItem)}
    </div>
  );
}

function IconBtn({
  children,
  title,
  danger,
  onClick
}: {
  children: React.ReactNode;
  title: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded p-1 text-zinc-500 transition hover:bg-white/10 ${danger ? "hover:text-red-400" : "hover:text-zinc-200"}`}
    >
      {children}
    </button>
  );
}

function DeleteModal({
  target,
  onCancel,
  onConfirm
}: {
  target: ConversationSummary | "all";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isAll = target === "all";
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full max-w-sm rounded-2xl p-6 shadow-2xl"
      >
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
          <Trash2 className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-bold text-white">
          {isAll ? "Delete all conversations?" : "Delete conversation?"}
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          {isAll
            ? "This soft-deletes all your conversations. The action is audit-logged and cannot be undone from here."
            : `"${(target as ConversationSummary).title}" will be removed from your history. This is audit-logged.`}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-lg border border-white/10 px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  copied,
  streaming,
  onCopy
}: {
  message: LocalMessage;
  copied: boolean;
  streaming: boolean;
  onCopy: () => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isUser ? "bg-white/5 text-zinc-300 ring-1 ring-white/10" : "bg-gradient-to-br from-teal-500/30 to-cyan-600/30 text-teal-300 ring-1 ring-teal-500/20"
        }`}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={`group min-w-0 max-w-[85%] ${isUser ? "items-end" : ""}`}>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser ? "rounded-br-sm bg-gradient-to-br from-teal-600 to-cyan-700 text-white" : "glass rounded-bl-sm text-zinc-200"
          }`}
        >
          {message.content || (streaming ? "" : " ")}
          {streaming ? <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-teal-400 align-middle" /> : null}
        </div>
        {!isUser && message.content ? (
          <button
            type="button"
            onClick={onCopy}
            className="mt-1.5 inline-flex items-center gap-1 text-xs text-zinc-500 opacity-0 transition hover:text-zinc-300 group-hover:opacity-100"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({ suggestions, onPick }: { suggestions: string[]; onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center pt-16 text-center">
      <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-600/20 text-teal-300 ring-1 ring-teal-500/20 glow-teal">
        <Sparkles className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-white">How can I assist your investigation?</h2>
      <p className="mt-2 max-w-md text-sm text-zinc-500">
        Mention an FIR number, suspect, or district — I&apos;ll retrieve the records and reason over them.
      </p>
      <div className="mt-7 grid w-full max-w-xl gap-2.5 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="glass group rounded-xl px-4 py-3.5 text-left text-sm text-zinc-300 transition-all hover:border-teal-500/30 hover:text-teal-200 hover:shadow-[0_0_24px_-10px_rgba(45,212,191,0.4)]"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-teal-500/60 transition group-hover:text-teal-400" />
              {s}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}
