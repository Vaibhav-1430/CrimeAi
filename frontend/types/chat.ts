export interface ChatMessageRow {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ConversationSummary {
  id: number;
  title: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string | null;
}

export interface ConversationDetail {
  id: number;
  title: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  messages: ChatMessageRow[];
}
