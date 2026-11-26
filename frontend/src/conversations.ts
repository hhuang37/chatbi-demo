import type { ChatResult, Table } from "./types";

export type Turn = { question: string; result?: ChatResult; error?: string };
export type Conversation = {
  id: string;
  title: string;
  turns: Turn[];
  updatedAt: number;
};

const LIST_KEY = "chatbi-conversations-v1";
const ACTIVE_KEY = "chatbi-active-v1";
const MAX_CONVERSATIONS = 50;
const MAX_TURNS = 50;

export function newConversation(): Conversation {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id, title: "", turns: [], updatedAt: Date.now() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeTable(value: unknown): Table | null {
  if (!isRecord(value)) return null;
  const columns = value.columns;
  const rows = value.rows;
  if (
    !Array.isArray(columns) ||
    !columns.every((c) => typeof c === "string") ||
    !Array.isArray(rows) ||
    !rows.every(isRecord)
  )
    return null;
  return {
    columns,
    rows: rows as Table["rows"],
    row_count: typeof value.row_count === "number" ? value.row_count : rows.length,
    truncated: value.truncated === true,
  };
}

function sanitizeResult(value: unknown): ChatResult | null {
  if (!isRecord(value)) return null;
  const kind = value.kind;
  if (kind !== "query" && kind !== "message" && kind !== "clarify") return null;
  if (typeof value.answer !== "string") return null;
  const warnings = Array.isArray(value.warnings)
    ? (value.warnings as unknown[]).filter((w) => typeof w === "string")
    : [];
  return {
    kind,
    answer: value.answer,
    sql: typeof value.sql === "string" ? value.sql : null,
    table: sanitizeTable(value.table),
    analysis: typeof value.analysis === "string" ? value.analysis : null,
    chart: null,
    warnings,
  };
}

function sanitizeTurn(value: unknown): Turn | null {
  if (!isRecord(value) || typeof value.question !== "string") return null;
  const turn: Turn = { question: value.question.slice(0, 2000) };
  if (typeof value.error === "string") turn.error = value.error;
  const result = sanitizeResult(value.result);
  if (result) turn.result = result;
  return turn;
}

function sanitizeConversation(value: unknown): Conversation | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const turns = Array.isArray(value.turns)
    ? (value.turns as unknown[])
        .map(sanitizeTurn)
        .filter((t): t is Turn => t !== null)
        .slice(-MAX_TURNS)
    : [];
  if (!turns.length) return null;
  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title.slice(0, 80) : "",
    turns,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now(),
  };
}

export type StoredConversations = {
  conversations: Conversation[];
  activeId: string | null;
};

export function loadConversations(): StoredConversations {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (!raw) return { conversations: [], activeId: null };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { conversations: [], activeId: null };
    const conversations = parsed
      .map(sanitizeConversation)
      .filter((c): c is Conversation => c !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS);
    const storedActive = localStorage.getItem(ACTIVE_KEY);
    const activeId =
      storedActive && conversations.some((c) => c.id === storedActive)
        ? storedActive
        : (conversations[0]?.id ?? null);
    return { conversations, activeId };
  } catch {
    return { conversations: [], activeId: null };
  }
}

export function saveConversations(
  conversations: Conversation[],
  activeId: string,
): boolean {
  try {
    const kept = conversations.filter((c) => c.turns.length > 0);
    localStorage.setItem(LIST_KEY, JSON.stringify(kept));
    const savedActive = kept.some((c) => c.id === activeId)
      ? activeId
      : (kept[0]?.id ?? "");
    localStorage.setItem(ACTIVE_KEY, savedActive);
    return true;
  } catch {
    return false;
  }
}

export function conversationTitle(conversation: Conversation): string {
  if (conversation.title.trim()) return conversation.title;
  const first = conversation.turns[0]?.question;
  if (first) return first.length > 48 ? first.slice(0, 48) + "…" : first;
  return "";
}

export function relativeTime(timestamp: number, language: "en" | "zh"): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return language === "zh" ? "刚刚" : "just now";
  if (minutes < 60)
    return language === "zh" ? `${minutes} 分钟前` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return language === "zh" ? `${hours} 小时前` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return language === "zh" ? `${days} 天前` : `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(
    language === "zh" ? "zh-CN" : "en-SG",
  );
}