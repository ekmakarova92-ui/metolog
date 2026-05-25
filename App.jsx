import { useState, useRef, useEffect } from "react"

const STAGES = {
  INTERVIEW: "interview",
  METHODOLOGY: "methodology",
  REVIEW: "review",
  CASES: "cases",
  DONE: "done",
}

const INTERVIEWER_PROMPT = `Ты — интервьюер. Собери бриф для образовательной программы. Задавай вопросы строго по одному, жди ответа перед следующим вопросом.

Порядок вопросов:
1. Тема и название программы
2. Целевая аудитория (кто будет учиться?)
3. Уровень подготовки участников (новички / средний / продвинутый)
4. Формат и длительность (онлайн/офлайн, сколько часов/дней)
5. Главная цель — что участник будет уметь делать после программы?
6. Особые требования или ограничения

Когда все 6 ответов получены — скажи: "Отлично, бриф собран! Передаю методологу." и верни JSON строго в таком формате:

<brief>
{
  "topic": "...",
  "audience": "...",
  "level": "...",
  "format": "...",
  "goal": "...",
  "requirements": "..."
}
</brief>

Не переходи к следующему вопросу пока не получишь ответ на текущий. Общайся дружелюбно и профессионально.`

const METHODOLOGIST_PROMPT = (brief, editorFeedback, iteration) => `Ты — опытный методолог образовательных программ.

БРИФ КЛИЕНТА:
${JSON.stringify(brief, null, 2)}

КРИТЕРИИ ПРОГРАММЫ:
- Минимум 3 модуля
- Каждый модуль: цель, теория, практика, задание
- Соотношение теория/практика: 40/60
- Финальный проект обязателен

${editorFeedback ? `ЗАМЕЧАНИЯ РЕДАКТОРА (итерация ${iteration}):\n${editorFeedback}\nУчти все замечания при доработке.` : ""}

Создай программу обучения строго по структуре:

## НАЗВАНИЕ ПРОГРАММЫ
**Цель:** ...
**Аудитория:** ...
**Формат:** ...
**Длительность:** ...

---
### МОДУЛЬ 1: [Название]
**Цель модуля:** ...
**Теория:** ...
**Практика:** ...
**Задание:** ...

[повтори для каждого модуля]

---
### ФИНАЛЬНЫЙ ПРОЕКТ
...

### ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ
...`

const EDITOR_PROMPT = (program, feedback) => `Ты — редактор образовательных программ. Составь чёткое ТЗ для методолога на доработку.

ПРОГРАММА:
${program}

ЗАМЕЧАНИЯ ПРОВЕРЯЮЩЕГО:
${feedback}

Формат ответа:
**ЧТО ПЕРЕДЕЛАТЬ:**
1. ...

**КАК ИМЕННО:**
- ...

**НА ЧТО ОБРАТИТЬ ВНИМАНИЕ:**
- ...

Будь конкретен и чёток. Без общих фраз.`

const CASES_PROMPT = (program, brief) => `Ты — составитель учебных кейсов и упражнений.

ПРОГРАММА:
${program}

БРИФ:
${JSON.stringify(brief, null, 2)}

Для каждого модуля создай:

### КЕЙС [N]: [название]
**Сценарий:** ...
**Задача:** ...
**Данные:** ...
**Ожидаемый результат:** ...
**Критерии оценки:**
- [ ] ...

### УПРАЖНЕНИЕ [N]: [название]
**Цель:** ...
**Инструкция (пошагово):** ...
**Время:** ...
**Форма сдачи:** ...

Сделай кейсы максимально приближенными к реальности аудитории.`

async function callClaude(messages, systemPrompt) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system: systemPrompt }),
  })
  if (!response.ok) throw new Error("API error")
  const data = await response.json()
  return data.content[0].text
}

function parseBrief(text) {
  const match = text.match(/<brief>([\s\S]*?)<\/brief>/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}

function Message({ msg }) {
  const isUser = msg.role === "user"
  const isSystem = msg.role === "system"

  if (isSystem) {
    return (
      <div style={{ textAlign: "center", margin: "1rem 0" }}>
        <span style={{
          fontSize: 12,
          color: "#8a7a6a",
          background: "#f5f0ea",
          padding: "4px 14px",
          borderRadius: 20,
          fontFamily: "'IBM Plex Sans', sans-serif",
          letterSpacing: "0.04em"
        }}>{msg.content}</span>
      </div>
    )
  }

  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 16,
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "#2c2416",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginRight: 10, flexShrink: 0, marginTop: 2,
          fontFamily: "'Playfair Display', serif",
          color: "#f5f0ea", fontSize: 13
        }}>М</div>
      )}
      <div style={{
        maxWidth: "72%",
        background: isUser ? "#2c2416" : "#fff",
        color: isUser ? "#f5f0ea" : "#2c2416",
        padding: "12px 16px",
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        border: isUser ? "none" : "1px solid #e8e0d4",
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 14,
        lineHeight: 1.7,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {msg.content.replace(/<brief>[\s\S]*?<\/brief>/, "").trim()}
      </div>
    </div>
  )
}

function StageIndicator({ stage }) {
  const stages = [
    { key: STAGES.INTERVIEW, label: "Бриф" },
    { key: STAGES.METHODOLOGY, label: "Программа" },
    { key: STAGES.REVIEW, label: "Проверка" },
    { key: STAGES.CASES, label: "Кейсы" },
    { key: STAGES.DONE, label: "Готово" },
  ]
  const current = stages.findIndex(s => s.key === stage)

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {stages.map((s, i) => (
        <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: i < current ? "#2c2416" : i === current ? "#c9a96e" : "#e8e0d4",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, color: i <= current ? "#fff" : "#8a7a6a",
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: 500, transition: "all 0.3s"
            }}>
              {i < current ? "✓" : i + 1}
            </div>
            <span style={{
              fontSize: 10, color: i === current ? "#2c2416" : "#8a7a6a",
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: i === current ? 500 : 400,
              letterSpacing: "0.03em"
            }}>{s.label}</span>
          </div>
          {i < stages.length - 1 && (
            <div style={{
              width: 32, height: 1,
              background: i < current ? "#2c2416" : "#e8e0d4",
              marginBottom: 18, transition: "all 0.3s"
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState(STAGES.INTERVIEW)
  const [brief, setBrief] = useState(null)
  const [program, setProgram] = useState("")
  const [iteration, setIteration] = useState(1)
  const [editorFeedback, setEditorFeedback] = useState("")
  const [interviewHistory, setInterviewHistory] = useState([])
  const [finalDoc, setFinalDoc] = useState("")
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    startInterview()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function startInterview() {
    setLoading(true)
    try {
      const reply = await callClaude([], INTERVIEWER_PROMPT)
      const firstMsg = { role: "assistant", content: reply }
      setMessages([firstMsg])
      setInterviewHistory([firstMsg])
    } catch (e) {
      setMessages([{ role: "assistant", content: "Ошибка подключения. Проверь API ключ в настройках." }])
    }
    setLoading(false)
  }

  async function handleSend() {
    if (!input.trim() || loading) return
    const userMsg = { role: "user", content: input.trim() }
    setInput("")
    setLoading(true)

    if (stage === STAGES.INTERVIEW) {
      const newHistory = [...interviewHistory, userMsg]
      setMessages(prev => [...prev, userMsg])

      try {
        const reply = await callClaude(
          newHistory.map(m => ({ role: m.role, content: m.content })),
          INTERVIEWER_PROMPT
        )
        const assistantMsg = { role: "assistant", content: reply }
        setMessages(prev => [...prev, assistantMsg])
        const updatedHistory = [...newHistory, assistantMsg]
        setInterviewHistory(updatedHistory)

        const parsedBrief = parseBrief(reply)
        if (parsedBrief) {
          setBrief(parsedBrief)
          setStage(STAGES.METHODOLOGY)
          setTimeout(() => runMethodologist(parsedBrief, "", 1), 500)
        }
      } catch (e) {
        setMessages(prev => [...prev, { role: "assistant", content: "Произошла ошибка. Попробуй снова." }])
      }
    } else if (stage === STAGES.REVIEW) {
      setMessages(prev => [...prev, userMsg])
      const answer = input.trim().toLowerCase()
      const approved = answer.startsWith("да") || answer === "yes"

      if (approved) {
        setStage(STAGES.CASES)
        setMessages(prev => [...prev, {
          role: "system", content: "✓ Программа одобрена — составляю кейсы и упражнения"
        }])
        setTimeout(() => runCases(), 300)
      } else {
        if (iteration >= 3) {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: "⚠️ Достигнут лимит итераций (3). Программа требует ручной доработки.\n\nПоследняя версия программы сохранена выше."
          }])
          setStage(STAGES.DONE)
        } else {
          setMessages(prev => [...prev, {
            role: "system", content: `Замечания приняты — редактор готовит ТЗ для методолога (итерация ${iteration + 1} из 3)`
          }])
          setTimeout(() => runEditor(input.trim()), 300)
        }
      }
    }

    setLoading(false)
    inputRef.current?.focus()
  }

  async function runMethodologist(briefData, feedback, iter) {
    setLoading(true)
    setMessages(prev => [...prev, {
      role: "system", content: `Методолог составляет программу${iter > 1 ? ` (итерация ${iter} из 3)` : ""}...`
    }])

    try {
      const reply = await callClaude(
        [{ role: "user", content: "Составь программу обучения." }],
        METHODOLOGIST_PROMPT(briefData || brief, feedback || editorFeedback, iter)
      )
      setProgram(reply)
      setMessages(prev => [...prev,
        { role: "assistant", content: reply },
        {
          role: "assistant",
          content: `📋 Итерация ${iter} из 3.\n\nОцени программу:\n✅ Напиши **да** — если всё устраивает, перейдём к кейсам\n❌ Напиши **нет: [твои замечания]** — отправлю на доработку`
        }
      ])
      setStage(STAGES.REVIEW)
      setIteration(iter)
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Ошибка при создании программы." }])
    }
    setLoading(false)
  }

  async function runEditor(feedback) {
    setLoading(true)
    setMessages(prev => [...prev, {
      role: "system", content: "Редактор анализирует замечания..."
    }])

    try {
      const reply = await callClaude(
        [{ role: "user", content: "Составь ТЗ для методолога." }],
        EDITOR_PROMPT(program, feedback)
      )
      setEditorFeedback(reply)
      setMessages(prev => [...prev, { role: "assistant", content: `📝 ТЗ редактора:\n\n${reply}` }])
      setTimeout(() => runMethodologist(brief, reply, iteration + 1), 500)
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Ошибка редактора." }])
    }
    setLoading(false)
  }

  async function runCases() {
    setLoading(true)
    setMessages(prev => [...prev, {
      role: "system", content: "Составитель создаёт кейсы и упражнения..."
    }])

    try {
      const reply = await callClaude(
        [{ role: "user", content: "Создай кейсы и упражнения." }],
        CASES_PROMPT(program, brief)
      )
      const doc = `# ${brief.topic}\n\n**Аудитория:** ${brief.audience}\n**Уровень:** ${brief.level}\n**Формат:** ${brief.format}\n**Цель:** ${brief.goal}\n\n---\n\n## ПРОГРАММА ОБУЧЕНИЯ\n\n${program}\n\n---\n\n## КЕЙСЫ И УПРАЖНЕНИЯ\n\n${reply}`
      setFinalDoc(doc)
      setStage(STAGES.DONE)
      setMessages(prev => [...prev,
        { role: "assistant", content: reply },
        { role: "system", content: "🎉 Образовательная программа готова!" }
      ])
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Ошибка при создании кейсов." }])
    }
    setLoading(false)
  }

  function downloadDoc() {
    const blob = new Blob([finalDoc], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${brief?.topic || "программа"}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const placeholder = stage === STAGES.REVIEW
    ? "да — одобрить / нет: [замечания] — на доработку"
    : "Напишите сообщение..."

  return (
    <div style={{
      minHeight: "100vh",
      background: "#faf7f2",
      fontFamily: "'IBM Plex Sans', sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      <header style={{
        background: "#fff",
        borderBottom: "1px solid #e8e0d4",
        padding: "0 24px",
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "#2c2416",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Playfair Display', serif",
            color: "#c9a96e", fontSize: 16
          }}>М</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#2c2416", letterSpacing: "-0.01em" }}>
              Методолог
            </div>
            <div style={{ fontSize: 11, color: "#8a7a6a", letterSpacing: "0.05em" }}>
              КОНСТРУКТОР ПРОГРАММ
            </div>
          </div>
        </div>
        <StageIndicator stage={stage} />
        {stage === STAGES.DONE && finalDoc && (
          <button onClick={downloadDoc} style={{
            background: "#2c2416",
            color: "#f5f0ea",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontWeight: 500,
          }}>
            Скачать программу
          </button>
        )}
      </header>

      <div style={{
        flex: 1,
        maxWidth: 720,
        width: "100%",
        margin: "0 auto",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}>
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "#2c2416",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Playfair Display', serif",
              color: "#c9a96e", fontSize: 13, flexShrink: 0
            }}>М</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#c9a96e",
                  animation: `bounce 1.2s infinite ${i * 0.2}s`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{
        position: "sticky",
        bottom: 0,
        background: "#faf7f2",
        borderTop: "1px solid #e8e0d4",
        padding: "16px",
      }}>
        <div style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={placeholder}
            disabled={loading || stage === STAGES.DONE}
            rows={1}
            style={{
              flex: 1,
              resize: "none",
              border: "1px solid #e8e0d4",
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 14,
              fontFamily: "'IBM Plex Sans', sans-serif",
              background: "#fff",
              color: "#2c2416",
              outline: "none",
              lineHeight: 1.5,
              maxHeight: 120,
              overflow: "auto",
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || stage === STAGES.DONE}
            style={{
              width: 44, height: 44,
              borderRadius: "50%",
              background: input.trim() && !loading ? "#2c2416" : "#e8e0d4",
              border: "none",
              cursor: input.trim() && !loading ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "background 0.2s",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke={input.trim() && !loading ? "#f5f0ea" : "#8a7a6a"} strokeWidth="2" strokeLinecap="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={input.trim() && !loading ? "#f5f0ea" : "#8a7a6a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        textarea:focus { border-color: #c9a96e !important; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
      `}</style>
    </div>
  )
}
