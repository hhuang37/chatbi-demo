import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import { Chart } from "./ChartView";
import { buildChartSpec } from "./chart";
import type { ChatResult, Connection, Health, Scenario } from "./types";
import {
  conversationTitle,
  loadConversations,
  newConversation,
  relativeTime,
  saveConversations,
  type Conversation,
} from "./conversations";
import "./style.css";

type Language = "en" | "zh";
const copy = {
  en: {
    newChat: "＋ New chat",
    workspace: "WORKSPACE",
    dataChat: "Data chat",
    connectedData: "CONNECTED DATA",
    localData: "● Local data",
    assistant: "Your retail data assistant",
    connected: "MaaS connected",
    settings: "Connection settings",
    checking: "Checking…",
    checkAgain: "Check again",
    model: "Model",
    checkingConnection: "Checking the MaaS connection…",
    rename: "Rename",
    storageWarning:
      "This browser blocked local storage. Conversations will not survive a refresh.",
    setup:
      "Copy backend/.env.example to .env, set MAAS_BASE_URL, MAAS_API_KEY and MAAS_MODEL, then restart the backend. Keys stay on the backend. Each connection check makes a small model request.",
    kicker: "FROM QUESTIONS TO CLARITY",
    titleA: "Every question opens",
    titleB: "your next business move.",
    introA: "Explore stores, products and sales in plain language.",
    introB: "Find answers in your data. Make informed decisions.",
    synthetic: "Synthetic demo data",
    assistantLabel: "DATA ASSISTANT",
    retry: "Retry",
    rows: "rows",
    results: "Query results",
    noData: "No matching data",
    sql: "View SQL",
    analysis: "Business analysis",
    loading: "Understanding your question and querying the data",
    placeholder:
      "Ask your data, e.g. Which store performed best in September 2026?",
    send: "Send question",
    language: "中文",
    backendOffline: "Backend is offline. Start the FastAPI service.",
    connectionFailed: "Connection failed. Please try again.",
  },
  zh: {
    newChat: "＋ 新对话",
    workspace: "工作空间",
    dataChat: "数据对话",
    connectedData: "已连接数据",
    localData: "● 本地数据",
    assistant: "你的零售数据助手",
    connected: "MaaS 已连接",
    settings: "配置与连接",
    checking: "检测中…",
    checkAgain: "重新检测",
    model: "模型",
    checkingConnection: "正在检测 MaaS 连接…",
    rename: "重命名",
    storageWarning: "浏览器本地存储不可用，刷新后对话将丢失。",
    setup:
      "将 backend/.env.example 复制为 .env，填写 MAAS_BASE_URL、MAAS_API_KEY 和 MAAS_MODEL，然后重启后端。密钥只保存在后端。每次连接检测会产生一次小额模型调用。",
    kicker: "从问题到答案",
    titleA: "每一个问题，",
    titleB: "都藏着生意的下一步。",
    introA: "用自然语言探索门店、商品与销售表现。",
    introB: "让数据回答，让决策更有依据。",
    synthetic: "合成演示数据",
    assistantLabel: "数据助手",
    retry: "重试",
    rows: "行",
    results: "查询结果",
    noData: "没有匹配数据",
    sql: "查看查询 SQL",
    analysis: "业务分析",
    loading: "正在理解问题并查询数据",
    placeholder: "问问你的数据，例如：2026 年 9 月哪个门店表现最好？",
    send: "发送问题",
    language: "English",
    backendOffline: "后端未连接，请先启动 FastAPI 服务。",
    connectionFailed: "连接失败，请重试。",
  },
} as const;
const zhSuggestions = [
  "2026 年 9 月各门店销售额是多少？",
  "2026 年每个月销售额的趋势如何？",
  "2026 年 9 月销售额最高的 5 个商品是什么？",
  "2026 年 9 月哪些商品品类销售额最高？",
  "2026 年线下和线上销售额如何比较？",
  "2026 年 9 月哪些门店的毛利率最高？",
];

function App() {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem("chatbi-language") as Language) || "en",
  );
  const [scenario, setScenario] = useState<Scenario>();
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const modelRef = useRef("");
  const autoCheckedFor = useRef("");
  const [connection, setConnection] = useState<Connection>({
    state: "checking",
    message: "Checking the MaaS connection…",
  });
  const [stored] = useState(() => {
    const loaded = loadConversations();
    const fallback = newConversation();
    return {
      list: loaded.conversations.length ? loaded.conversations : [fallback],
      activeId: loaded.activeId ?? fallback.id,
    };
  });
  const [conversations, setConversations] = useState<Conversation[]>(
    stored.list,
  );
  const [activeId, setActiveId] = useState<string>(stored.activeId);
  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? conversations[0];
  const turns = activeConversation?.turns ?? [];
  const [question, setQuestion] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const busy = busyId !== null;
  const [checking, setChecking] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const renameCancelled = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const t = copy[language];
  useEffect(() => {
    try {
      localStorage.setItem("chatbi-language", language);
    } catch {}
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);
  useEffect(() => {
    if (!saveConversations(conversations, activeId)) setStorageWarning(true);
  }, [conversations, activeId]);
  useEffect(() => {
    let active = true;
    api<Scenario>("/scenario")
      .then((x) => {
        if (active) setScenario(x);
      })
      .catch(() => {});
    const refresh = () =>
      api<Health>("/health")
        .then((x) => {
          if (!active) return;
          if (x.models?.length) {
            setModels(x.models);
            if (!modelRef.current || !x.models.includes(modelRef.current)) {
              modelRef.current = x.default_model;
              setModel(x.default_model);
            }
          }
          const maas = x.maas;
          if (maas.model && modelRef.current && maas.model !== modelRef.current) {
            // The backend status belongs to another model, so it cannot describe
            // the current one. Check once instead of leaving the banner stuck.
            if (autoCheckedFor.current !== modelRef.current) {
              autoCheckedFor.current = modelRef.current;
              setConnection({
                state: "checking",
                message: t.checkingConnection,
              });
              check(modelRef.current);
            }
          } else {
            setConnection(maas);
          }
        })
        .catch(() => {
          if (active)
            setConnection({
              state: "backend_offline",
              message: t.backendOffline,
            });
        });
    refresh();
    const id = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [t.backendOffline]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);
  async function check(target = modelRef.current) {
    setChecking(true);
    try {
      setConnection(
        await api<Connection>("/connection/check", {
          model: target || undefined,
        }),
      );
    } catch (e) {
      setConnection({
        state: "backend_offline",
        message: e instanceof Error ? e.message : t.connectionFailed,
      });
    } finally {
      setChecking(false);
    }
  }
  function switchModel(next: string) {
    if (next === modelRef.current || !next) return;
    modelRef.current = next;
    setModel(next);
    setConnection({ state: "checking", message: t.checkingConnection });
    check(next);
  }
  function updateConversation(
    id: string,
    updater: (c: Conversation) => Conversation,
  ) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...updater(c), updatedAt: Date.now() } : c,
      ),
    );
  }
  function startNewChat() {
    if (activeConversation && activeConversation.turns.length === 0) return;
    const fresh = newConversation();
    setRenamingId(null);
    setConversations((prev) => [...prev, fresh]);
    setActiveId(fresh.id);
    setQuestion("");
  }
  function switchTo(id: string) {
    if (id === activeId) return;
    const currentId = activeId;
    setRenamingId(null);
    setConversations((prev) =>
      prev.filter((c) => c.id !== currentId || c.turns.length > 0),
    );
    setActiveId(id);
    setQuestion("");
  }
  function commitRename(value: string) {
    const id = renamingId;
    setRenamingId(null);
    const name = value.trim();
    if (!id || !name) return;
    updateConversation(id, (c) => ({ ...c, title: name.slice(0, 80) }));
  }
  async function send(text = question) {
    const conversation = activeConversation;
    if (!text.trim() || inFlight.current || !conversation) return;
    const convId = conversation.id;
    inFlight.current = true;
    setBusyId(convId);
    setQuestion("");
    const history = conversation.turns
      .filter((x) => x.result)
      .slice(-6)
      .flatMap((x) => [
        { role: "user", content: x.question },
        {
          role: "assistant",
          content: (
            x.result!.answer +
            "\nSQL scope: " +
            (x.result!.sql || "")
          ).slice(0, 3000),
        },
      ]);
    updateConversation(convId, (c) => ({
      ...c,
      turns: [...c.turns, { question: text }],
    }));
    try {
      const result = await api<ChatResult>("/chat", {
        question: text,
        language,
        history,
        model: modelRef.current || undefined,
      });
      updateConversation(convId, (c) => ({
        ...c,
        turns: c.turns.map((turn, i) =>
          i === c.turns.length - 1 ? { ...turn, result } : turn,
        ),
      }));
    } catch (e) {
      const error =
        e instanceof Error ? e.message : t.connectionFailed;
      updateConversation(convId, (c) => ({
        ...c,
        turns: c.turns.map((turn, i) =>
          i === c.turns.length - 1 ? { ...turn, error } : turn,
        ),
      }));
    } finally {
      inFlight.current = false;
      setBusyId(null);
    }
  }
  const suggestions =
    language === "zh" ? zhSuggestions : scenario?.suggestions || [];
  return (
    <div className="layout">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="ChatBI home">
          <img className="brand-icon" src="/merlion-v2.png" alt="" />
          <div>
            Lion City<span>RETAIL INTELLIGENCE</span>
          </div>
        </a>
        <button className="new-chat" onClick={startNewChat}>
          {t.newChat}
        </button>
        <div className="conversation-list">
          {[...conversations]
            .filter((c) => c.turns.length > 0 || c.id === activeId)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((c) => (
              <div
                key={c.id}
                className={
                  "conversation-item" + (c.id === activeId ? " active" : "")
                }
              >
                {renamingId === c.id ? (
                  <input
                    autoFocus
                    aria-label={t.rename}
                    defaultValue={conversationTitle(c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      } else if (e.key === "Escape") {
                        renameCancelled.current = true;
                        e.currentTarget.blur();
                      }
                    }}
                    onBlur={(e) => {
                      if (renameCancelled.current) {
                        renameCancelled.current = false;
                        setRenamingId(null);
                      } else {
                        commitRename(e.currentTarget.value);
                      }
                    }}
                  />
                ) : (
                  <>
                    <button
                      className="conversation-open"
                      onClick={() => switchTo(c.id)}
                      title={conversationTitle(c)}
                    >
                      <span className="conversation-title">
                        {conversationTitle(c)}
                      </span>
                      <small>{relativeTime(c.updatedAt, language)}</small>
                    </button>
                    <button
                      className="conversation-rename"
                      aria-label={t.rename}
                      title={t.rename}
                      onClick={() => {
                        renameCancelled.current = false;
                        setRenamingId(c.id);
                      }}
                    >
                      ✎
                    </button>
                  </>
                )}
              </div>
            ))}
          {storageWarning && (
            <p className="storage-warning">{t.storageWarning}</p>
          )}
        </div>
        <div className="nav-label">{t.workspace}</div>
        <div className="nav-item">
          ◈ &nbsp; {t.dataChat} <span>01</span>
        </div>
        <div className="source-card">
          <div className="eyebrow">{t.connectedData}</div>
          <h3>{scenario?.name || "Lion City Retail"}</h3>
          <p>Singapore retail demo data</p>
          <div className="source-meta">
            SQLite <span>{t.localData}</span>
          </div>
          <small>{scenario?.date_range.join(" → ")}</small>
        </div>
        <div className="sidebar-footer">
          <span className="avatar">LC</span>
          <div>
            Retail workspace<small>Powered by Huawei Cloud MaaS</small>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <span className="header-title">ChatBI</span>
            <span className="header-slash">/</span>
            <span className="header-sub">{t.assistant}</span>
          </div>
          <div className="header-actions">
            {models.length > 0 && (
              <select
                className="model-select"
                aria-label={t.model}
                title={t.model}
                value={model}
                disabled={busy || checking}
                onChange={(e) => switchModel(e.target.value)}
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
            <button
              className="language-toggle"
              onClick={() => setLanguage(language === "en" ? "zh" : "en")}
            >
              {t.language}
            </button>
            <button
              className="connection"
              onClick={() => setShowSetup((x) => !x)}
            >
              <i className={connection.state === "connected" ? "green" : ""} />
              {connection.state === "connected" ? t.connected : t.settings}
            </button>
          </div>
        </header>
        {(showSetup || connection.state !== "connected") && (
          <div className="setup">
            <div>
              <strong>{connection.message}</strong>
              {showSetup && <p>{t.setup}</p>}
            </div>
            <button onClick={() => check()} disabled={checking}>
              {checking ? t.checking : t.checkAgain}
            </button>
          </div>
        )}
        <div className="conversation">
          {turns.length === 0 ? (
            <section className="welcome">
              <img
                className="welcome-mark"
                src="/merlion-v2.png"
                alt="Merlion"
              />
              <div className="eyebrow">{t.kicker}</div>
              <h1>
                {t.titleA}
                <br />
                <span>{t.titleB}</span>
              </h1>
              <p>
                {t.introA}
                <br />
                {t.introB}
              </p>
              <div className="suggestions">
                {suggestions.map((q, i) => (
                  <button key={q} disabled={busy} onClick={() => send(q)}>
                    <span className="suggest-icon">
                      {["◈", "↗", "▤", "◎"][i]}
                    </span>
                    <span>{q}</span>
                    <span className="arrow">↗</span>
                  </button>
                ))}
              </div>
              <div className="dataset-note">
                SGD · {scenario?.date_range.join(" — ")} · {t.synthetic}
              </div>
            </section>
          ) : (
            <div className="messages">
              {turns.map((turn, i) => {
                const spec =
                  turn.result?.table && turn.result.table.rows.length
                    ? buildChartSpec(turn.result.table)
                    : null;
                return (
                <section className="turn" key={i}>
                  <div className="user-message">{turn.question}</div>
                  <div className="assistant-message">
                    <img
                      className="assistant-icon"
                      src="/merlion-v2.png"
                      alt=""
                    />
                    <div className="answer-body">
                      <div className="answer-label">
                        CHATBI <span>{t.assistantLabel}</span>
                      </div>
                      {turn.error ? (
                        <div role="alert" className="error">
                          {turn.error}
                          <button
                            disabled={busy}
                            onClick={() => send(turn.question)}
                          >
                            {t.retry}
                          </button>
                        </div>
                      ) : turn.result ? (
                        <>
                          <p className="text-answer">{turn.result.answer}</p>
                          {turn.result.table && (
                            <div className="table-card">
                              <div className="table-heading">
                                {t.results}{" "}
                                <span>
                                  {turn.result.table.row_count} {t.rows} ·{" "}
                                  {scenario?.currency}
                                </span>
                              </div>
                              {spec && (
                                <div className="chart-card">
                                  <Chart spec={spec} />
                                </div>
                              )}
                              <div className="table-scroll">
                                <table>
                                  <thead>
                                    <tr>
                                      {turn.result.table.columns.map((c) => (
                                        <th key={c}>{c}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {turn.result.table.rows.map((row, r) => (
                                      <tr key={r}>
                                        {turn.result!.table!.columns.map(
                                          (c) => (
                                            <td key={c}>
                                              {row[c] === null
                                                ? "—"
                                                : typeof row[c] === "number"
                                                  ? new Intl.NumberFormat(
                                                      language === "zh"
                                                        ? "zh-CN"
                                                        : "en-SG",
                                                      {
                                                        maximumFractionDigits: 2,
                                                      },
                                                    ).format(row[c] as number)
                                                  : String(row[c])}
                                            </td>
                                          ),
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {!turn.result.table.rows.length && (
                                <p className="empty">{t.noData}</p>
                              )}
                            </div>
                          )}
                          {turn.result.sql && (
                            <details className="sql">
                              <summary>{t.sql}</summary>
                              <pre>{turn.result.sql}</pre>
                            </details>
                          )}
                          {turn.result.analysis && (
                            <div className="analysis">
                              <h3>✦ {t.analysis}</h3>
                              <p>{turn.result.analysis}</p>
                            </div>
                          )}
                          {turn.result.warnings.map((w) => (
                            <p className="warning" key={w}>
                              {w}
                            </p>
                          ))}
                        </>
                      ) : (
                        <p className="loading">
                          {t.loading}
                          <span>…</span>
                        </p>
                      )}
                    </div>
                  </div>
                 </section>
                );
              })}
             </div>
          )}
          <div ref={bottom} />
        </div>
        <div className="composer-wrap">
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              aria-label={t.placeholder}
              placeholder={t.placeholder}
              value={question}
              maxLength={2000}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <div className="composer-bottom">
              <span>
                {language === "zh"
                  ? "直接提问，也可以要求分析或解释。"
                  : "Ask a question, or request analysis and explanations."}
              </span>
              <button
                className="send"
                type="submit"
                disabled={busy || !question.trim()}
                aria-label={t.send}
              >
                {busy ? "…" : "↑"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
