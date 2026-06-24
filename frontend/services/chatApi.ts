import api from "@/services/api";
import type { ConversationDetail, ConversationSummary } from "@/types/chat";

export async function listConversations(search?: string): Promise<ConversationSummary[]> {
  const response = await api.get<ConversationSummary[]>("/ai/conversations", {
    params: search ? { search } : {}
  });
  return response.data;
}

export async function createConversation(title?: string): Promise<ConversationDetail> {
  const response = await api.post<ConversationDetail>("/ai/conversations", { title });
  return response.data;
}

export async function getConversation(id: number): Promise<ConversationDetail> {
  const response = await api.get<ConversationDetail>(`/ai/conversations/${id}`);
  return response.data;
}

export async function renameConversation(id: number, title: string): Promise<ConversationSummary> {
  const response = await api.patch<ConversationSummary>(`/ai/conversations/${id}/rename`, { title });
  return response.data;
}

export async function pinConversation(id: number, pinned: boolean): Promise<ConversationSummary> {
  const response = await api.patch<ConversationSummary>(`/ai/conversations/${id}/pin`, { pinned });
  return response.data;
}

export async function deleteConversation(id: number): Promise<void> {
  await api.delete(`/ai/conversations/${id}`);
}

export async function bulkDeleteConversations(ids: number[]): Promise<void> {
  await api.post("/ai/conversations/bulk-delete", { ids });
}

export async function deleteAllConversations(): Promise<void> {
  await api.post("/ai/conversations/delete-all", {});
}
