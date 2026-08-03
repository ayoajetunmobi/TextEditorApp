## Document Generator and Office Tool built with Generative AI

**An application which helps you generate precised document templates from our knowledge base of already formated documents, 
it further allows you explore a document using Artificial intelligence finally it gives room for various document or file conversion**

### Technology
1. FastApi
2. Next.js
3. Node.js
4. Redis
5. LangGraph
6. Ollama
7. Websockets

### Getting Started
clone github repository

#### Setup
	settup ollama locally with any model of your choice
	
	create an account with google ai studio and get an API token for gemma
	
	create an .env file in the AI folder
	
	paste the following code in the file
	```GOOGLE_API_KEY=API-OF-GEMMA-LLM ```

	install docker desktop for windows and start up a redis container running on the default port

make sure you have python(3.12 precisely) and node installed on your machine

**Note if you  have different versions of python, you must set your preffered interpreter in vscode**

create a virtual env for python
```
	python -m venv env
```
install all requirements in the requirements.txt file

startup your fastapi server.

npm install for node and next.js
and startup their respective servers

head over to browser and interact with the application.
# 📝 AI Document Studio — Intelligent Editor & Data Analytics Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-FF6F00?style=for-the-badge&logo=chainlink&logoColor=white)](https://www.langchain.com/langgraph)
[![Gemini LLM](https://img.shields.io/badge/Gemini_LLM-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Plotly](https://shields.io)](https://plotly.com)

> **An end-to-end AI-powered document generation, Excel analytics, and visual dashboard generation platform built with FastAPI, Next.js, LangGraph, and Gemini LLM.**

---

## 📖 Overview

**AI Document Studio** is an intelligent web application designed to simplify document generation, text analysis, and data processing. Powered by Google’s **Gemini LLM** and orchestrated with **LangGraph**, the application enables users to seamlessly craft multi-format documents, summarize lengthy files, highlight key terms, and analyze complex Excel sheets to produce sub-tables, analytical reports, and interactive dashboards in real time.

---

## ✨ Key Features

### 📄 1. AI Document Generation & Export
* **Smart Content Generation:** Craft customized documents instantly using prompt-driven workflows with **Gemini LLM**.
* **Multi-Format Downloads:** Download generated content across multiple formats (PDF, DOCX, TXT, Markdown, etc.).

### 📑 2. Intelligent Document Summarization & Keyword Highlighting
* **Automated Summaries:** Extract core takeaways from large documents in seconds.
* **Contextual Highlighting:** Highlights key terms, entities, and critical metrics directly in the text to accelerate reading comprehension.

### 📊 3. Excel Analysis & Dashboard Generation
* **Spreadsheet Insight Engine:** Analyzes complex Excel tables to summarize structured data and detect patterns.
* **Sub-Table Extraction:** Automatically breaks down oversized spreadsheets into clean, digestible sub-tables based on custom queries.
* **Analytical Reports & Visual Dashboards:** Converts raw Excel rows into visual analytics, charts, and detailed data summaries.

---

## 🏗 System Architecture

```text
       +-------------------------------------------------------+
       |                  Next.js Frontend                     |
       |       (TypeScript, Tailwind CSS, HTML5/CSS3)          |
       +---------------------------+---------------------------+
                                   |
                                   v  (REST / WebSockets)
       +-------------------------------------------------------+
       |                  FastAPI Backend                      |
       |                (Node.js / Python Engine)              |
       +-------------+---------------------------+-------------+
                     |                           |
                     v                           v
          +--------------------+      +--------------------+
          |    Redis Cache     |      |  LangGraph Core    |
          |  (Session/State)   |      |  (Gemini LLM Agent)|
          +--------------------+      +--------------------+
                                                 |
                                                 v
                                      +--------------------+
                                      | Dynamic Dashboards |
                                      | & Export Engine    |
                                      +--------------------+
```

---

## 🛠 Tech Stack & Tools

* **Frontend:** [Next.js](https://nextjs.org/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/), HTML5/CSS3
* **Backend:** [FastAPI](https://fastapi.tiangolo.com/) (Python), [Node.js](https://nodejs.org/)
* **AI Orchestration & LLM:** [LangGraph](https://www.langchain.com/langgraph) & [Google Gemini LLM](https://deepmind.google/technologies/gemini/)
* **Caching & State Management:** [Redis](https://redis.io/)

---

## 📂 Project Structure

```text
TextEditorApp/
├── backend/
├── frontend/
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have the following installed on your machine:
* **Node.js (v18+)** & **npm/pnpm**
* **Python (3.10+)**
* **Redis Server**
* **Google Gemini API Key**

---

### 1. Clone the Repository
```bash
git clone https://github.com/ayoajetunmobi/TextEditorApp.git
cd TextEditorApp
```

### 2. Configure Environment Variables

Create a `.env` file in your root/backend directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
REDIS_URL=redis://localhost:6379
FASTAPI_PORT=5000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

### 3. Backend Setup (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 5000
```

---

### 4. Frontend Setup (Next.js)

Open a new terminal tab and run:

```bash
cd frontend
npm install
npm run dev
```

Open your browser and navigate to `http://localhost:3000`.

---

## ⚙️ AI Workflow Pipeline

| Module | Engine | Output |
| :--- | :--- | :--- |
| **Document Generation** | LangGraph + Gemini | Rich text, exports to DOCX, PDF, Markdown |
| **Document Highlighting** | Gemini Agent | Contextual entity identification & key phrase markup |
| **Excel Analytics** | Python Pandas/FastAPI + LangGraph | Generated sub-tables, summary reports, dynamic visual charts |

---

## 📜 License

Distributed under the MIT License.
