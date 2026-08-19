# TaskFlow: Armanda AI 🏆 (Grand Prix Winner)

An intelligent task management platform featuring an AI agent that organizes schedules via chat interactions and voice commands.

> 🏆 **Achievement:** Awarded **Grand Prix** at the hackathon.

---

### 🛡️ Academic & Technical Overview

This project demonstrates core competencies in **Artificial Intelligence, Human-Computer Interaction (HCI), and Edge/Local AI Processing**:

* **Local Speech-to-Text Processing:** Integrates **Faster-Whisper** for high-performance, low-latency local audio transcription, eliminating external privacy risks associated with speech data.
* **Natural Language Intent Parsing:** Leverages LLM pipelines (OpenAI / Claude) for structured function calling, contextual intent extraction, and automated calendar/schedule state updates.
* **Full-Stack API Integration:** Built with a modern decoupled architecture utilizing FastAPI (Python) for asynchronous AI service handling and React (Vite) for state management and UI interactions.

> **Project Status:** *Completed (Hackathon Winner MVP)*. Built to showcase voice processing, AI agent integration, and rapid full-stack prototyping.

---

## 🤖 AI Technologies & Architecture

* **Armanda AI (LLM Engine):** Uses OpenAI (GPT-4o/o1) or Claude (Anthropic) models to parse natural language queries, resolve temporal dependencies, and manage task schedules (e.g., handling commands like *"reschedule my review to tomorrow"* or *"create a workout session for tonight"*).
* **Faster-Whisper Engine:** Local high-efficiency automatic speech recognition (ASR) engine for voice command transcription, serving as the multimodal input layer for the AI agent.

---

## 🛠️ Installation & Setup

### 1. Backend (Python / FastAPI)

Navigate to the `backend` directory:

```bash
cd backend
```

Create and activate a virtual environment:

**Linux / macOS:**

```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows (PowerShell):**

```powershell
python -m venv venv
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
pip install faster-whisper
```

Run the server:

```bash
uvicorn main:app --reload --port 8000
```

> The API server runs at `http://127.0.0.1:8000`. The SQLite database (`taskflow.db`) is generated automatically.

---

### 2. Frontend (React / Vite)

In a new terminal window, navigate to the `frontend` directory:

```bash
cd frontend
npm install
npm run dev
```

> Access the web client at `http://localhost:5173`.

---

## 🔑 Environment Variables (.env)

Create a `.env` file inside the `backend` folder:

```env
# AI Assistant API Key
OPENAI_API_KEY=your_openai_api_key_here

# Database Configuration
DATABASE_URL=sqlite:///./taskflow.db
```

---

## 📂 Project Structure

```text
she-codes/
├── frontend/                  # React + Vite frontend
│   ├── src/api.js             # Axios configuration for backend communication
│   └── vite.config.js         # Proxy configuration (/api -> localhost:8000)
└── backend/                   # FastAPI backend engine
    ├── routers/ai_agent.py    # AI intent processing logic
    ├── services/transcribe.py # Voice recognition via Faster-Whisper
    ├── database.py            # SQLAlchemy & SQLite setup
    └── main.py                # Server entrypoint
```

---

## 🔧 Troubleshooting

* **Fatal error in launcher:** If you move the project directory, delete the `venv` folder and recreate it.
* **Empty Database:** Verify you are opening `taskflow.db` from the exact absolute path printed by the server in the terminal logs on startup.
* **ModuleNotFoundError (faster_whisper):** Ensure your virtual environment is active (`(venv)` shown in your terminal prompt) before installing packages.

