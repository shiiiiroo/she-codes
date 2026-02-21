# TaskFlow — AI-powered Task Manager

## Стек
- **Backend**: Python 3.11+ · FastAPI · SQLite · SQLAlchemy
- **Frontend**: React 18 · Vite · TailwindCSS · Recharts
- **AI**: Anthropic Claude (агент + анализ) · OpenAI Whisper (голос→текст)

---

## Быстрый старт

### 1. Backend

```bash
cd backend

# Создать виртуальное окружение
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Установить зависимости
pip install -r requirements.txt

# Создать .env файл
cp .env.example .env
# Открыть .env и вставить ваши ключи:
#   ANTHROPIC_API_KEY=sk-ant-...
#   OPENAI_API_KEY=sk-...   (нужен только для голосовых сообщений)

# Запустить сервер
uvicorn main:app --reload --port 8000
```

API будет доступен на http://localhost:8000  
Swagger-документация: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Приложение откроется на http://localhost:5173

---

## Структура проекта

```
taskflow/
├── backend/
│   ├── main.py               # FastAPI app entry point
│   ├── database.py           # SQLAlchemy models + SQLite setup
│   ├── requirements.txt
│   ├── .env.example
│   ├── routers/
│   │   ├── tasks.py          # CRUD задач, calendar API, tips, load
│   │   ├── ai_agent.py       # Chat, voice, file upload endpoints
│   │   └── profile_stats.py  # Profile + Statistics endpoints
│   └── services/
│       ├── agent.py          # Основной AI агент (Claude)
│       ├── transcribe.py     # Whisper STT
│       └── load_analyzer.py  # Анализ нагрузки, генерация советов
│
└── frontend/
    ├── src/
    │   ├── App.jsx           # Роутинг + навигация
    │   ├── main.jsx          # Entry point
    │   ├── api.js            # Axios клиент
    │   ├── store.js          # Zustand глобальное состояние
    │   ├── index.css         # Глобальные стили + CSS переменные
    │   ├── pages/
    │   │   ├── Main.jsx      # Главная: Календарь + Чат
    │   │   ├── Profile.jsx   # Профиль пользователя
    │   │   └── Statistics.jsx # Дашборд аналитики
    │   └── components/
    │       ├── Calendar.jsx  # Вид день/неделя/месяц/год
    │       ├── ChatBox.jsx   # AI чат с голосом и файлами
    │       ├── Widgets.jsx   # TipsBar, AddTaskForm, UnsortedPanel
    │       └── UI.jsx        # Переиспользуемые компоненты
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── postcss.config.js
```

---

## API Endpoints

### Tasks
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /tasks/?view=day&date_str=2025-02-21 | Задачи по виду/дате |
| GET | /tasks/unsorted | Задачи без сортировки |
| GET | /tasks/overdue | Просроченные задачи |
| GET | /tasks/tips | Советы + нагрузка |
| POST | /tasks/ | Создать задачу |
| PATCH | /tasks/{id} | Обновить задачу |
| POST | /tasks/{id}/complete | Выполнить задачу |
| POST | /tasks/{id}/postpone?new_date=... | Перенести задачу |
| PATCH | /tasks/{id}/subtasks/{idx} | Переключить подзадачу |
| DELETE | /tasks/{id} | Удалить задачу |

### AI Agent
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /ai/history | История чата |
| POST | /ai/chat | Текстовое сообщение |
| POST | /ai/voice | Голосовое сообщение (audio file) |
| POST | /ai/upload-file | Загрузить файл с задачами |
| WS | /ai/ws | WebSocket чат |

### Profile & Stats
| Метод | Путь | Описание |
|-------|------|----------|
| GET | /profile/ | Профиль пользователя |
| PATCH | /profile/ | Обновить профиль |
| GET | /profile/memories | Память AI |
| DELETE | /profile/memories/{id} | Удалить воспоминание |
| GET | /stats/overview | Общая статистика |
| GET | /stats/daily?days=30 | Статистика по дням |
| GET | /stats/heatmap?year=2025 | Heatmap данные |

---

## Как работает AI агент

1. **Принимает** текст, голос (через Whisper) или файл
2. **Строит системный промпт** с контекстом пользователя (профиль, расписание, здоровье, память)
3. **Анализирует** и возвращает структурированный JSON:
   - Задачи для создания (с категорией, приоритетом, длительностью, дедлайном)
   - Задачи в "unsorted" если данных недостаточно
   - Уточняющие вопросы
   - Советы по загруженности
   - Новые воспоминания о пользователе
4. **Сохраняет** задачи в SQLite, воспоминания в отдельную таблицу
5. **Следующий разговор** уже включает все накопленные воспоминания

---

## Расширение проекта

- **Уведомления**: подключить APScheduler + email/Telegram
- **Мультипользователь**: добавить JWT авторизацию
- **PDF парсинг**: добавить `pypdf2` в `upload-file` endpoint
- **Мобильная версия**: PWA манифест уже можно добавить
- **Деплой**: Backend на Railway, Frontend на Vercel
