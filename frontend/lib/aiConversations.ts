import type { Conversation } from "@/types/ai";

const STORAGE_KEY = "crimeai_ai_conversations";

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") return;
  // Keep the 30 most recent to bound storage.
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 30)));
}

export function createConversation(): Conversation {
  return {
    id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: "New conversation",
    messages: [],
    updatedAt: new Date().toISOString()
  };
}

export function conversationTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim();
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed || "New conversation";
}
