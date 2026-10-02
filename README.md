<div align="center">

```
 ____                         _   ___ ___
|  _ \ _ __ ___  ___  ___ _ _| |_|_ _/ _ \
| |_) | '__/ _ \/ __|/ _ \ '_ \ __|| | | | |
|  __/| | |  __/\__ \  __/ | | | |_ | | |_| |
|_|   |_|  \___||___/\___|_| |_|\__|___\__\_\
```

### An AI coach for people who struggle with presenting

[![Live Preview](https://img.shields.io/badge/Live-Preview-0ea5e9?style=for-the-badge&logo=vercel)](https://github.com/Reabot6/presentIq)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/Reabot6/presentIq)
[![Built for](https://img.shields.io/badge/Built%20for-FirstCommit%202026-8b5cf6?style=for-the-badge)](#)

</div>

---

## What is presentIQ?

Presenting is hard.

For many people, presentations become a real barrier — in school, interviews, pitches, and the workplace. Most feedback only arrives *after* the presentation is already over.

**presentIQ** is an AI presentation coach that lets people practise privately and get useful feedback *before* the stakes are high.

It listens to what you say, observes how you deliver it, and analyses multiple aspects of your presentation so you can clearly see what you’re doing well and what you can improve.

Built with **inclusive education** in mind — a private, judgement-free space to practise at your own pace.

---

## How It Works

```
┌───────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
│   QUIZ    │ ──► │  RECORD   │ ──► │  ANALYSE  │ ──► │  FEEDBACK │
└───────────┘     └───────────┘     └───────────┘     └───────────┘
```

| Step | What happens |
|------|--------------|
| **1. Quiz** | Short pre-presentation quiz to check understanding of the material |
| **2. Record** | Record your presentation directly in the app |
| **3. Analyse** | Speech recognition, language analysis, and computer vision run in parallel |
| **4. Feedback** | Signals are combined into clear strengths + actionable improvements |

---

## Features

| Icon | Feature | Description |
|------|---------|-------------|
| 🎯 | **Pre-presentation Quiz** | Checks whether the presenter understands their material before they begin |
| 🎙️ | **Speech Analysis** | OpenAI Whisper transcription + speech data for deeper analysis |
| 👁️ | **Computer Vision** | Analyses visual delivery and presentation behaviour |
| 👐 | **Gesture & Posture** | Detects and evaluates gestures, posture, and body language |
| 📝 | **Language Analysis** | Examines word choice, phrasing, and clarity |
| 💡 | **Actionable Feedback** | Turns raw analysis into clear, human-friendly improvement advice |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React · Vite · JavaScript |
| **Styling** | HTML · CSS |
| **Backend** | Python · FastAPI |
| **Speech Recognition** | OpenAI Whisper |
| **Computer Vision** | Computer Vision pipeline |
| **Language Analysis** | Groq / AI |
| **API Communication** | REST |

---

## Project Structure

```
presentIq/
│
├── presentiq-frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── presentiq-backend/
│   ├── ...
│   └── ...
│
└── .gitignore
```

Clean separation: **React/Vite frontend** + **Python/FastAPI backend**.

---

## Live Preview

A hosted version of the frontend experience is available:

**→ [Open presentIQ Live Preview](https://github.com/Reabot6/presentIq)**

> **Note:** The hosted preview currently shows the frontend experience.  
> The complete application includes a backend that handles speech, language, and computer-vision analysis.

---

## Running the Full Application Locally

### Prerequisites

- Git
- Node.js + npm
- Python 3.x + pip

### 1. Clone the repository

```bash
git clone https://github.com/Reabot6/presentIq.git
cd presentIq
```

### 2. Start the Backend

```bash
cd presentiq-backend

# Create & activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Environment variables
cp .env.example .env
# → Add your API credentials to .env

# Start the server
uvicorn main:app --reload
```

### 3. Start the Frontend

Open a second terminal:

```bash
cd presentIq/presentiq-frontend

npm install
npm run dev
```

Vite will give you a local URL (usually `http://localhost:5173`). Open it in your browser.

---

## Environment Variables

Create a `.env` file inside `presentiq-backend/`:

```bash
cp .env.example .env
```

Then add the required API credentials.

> **Important**  
> Never commit your `.env` file or expose API keys publicly.  
> Variable names should match those used by the backend’s Groq client.

---

## Why Isn’t the Full Backend Hosted?

I wanted a full live deployment, but the backend needs server-side resources for the AI and computer-vision pipeline.

During the hackathon, free hosting options either had tight usage limits or were only available for a short time. Rather than ship a backend that could become unavailable, I kept the complete application **fully runnable locally** and provided a hosted frontend preview for judges.

The public GitHub repository contains everything needed to run the full stack.

---

## Screenshots

<!-- Add screenshots or a demo GIF here -->

```
Presentation Workflow
─────────────────────
        Quiz
         ↓
  Record Presentation
         ↓
 Speech + Vision Analysis
         ↓
   Language Analysis
         ↓
 Personalised Feedback
```

---

## Challenges

One of the biggest challenges was turning something subjective like “good presenting” into measurable signals.

A presentation isn’t only about the words. Delivery also involves:

- Pacing
- Gestures
- Posture
- Body language
- Word choice

I had to design independent analysis paths and then combine them into feedback that feels useful — not just a wall of numbers.

Other challenges included:

- Processing recorded audio + video
- Connecting multiple analysis systems into one coherent workflow
- Deployment constraints (resource-heavy backend on free hosting)

---

## What I Learned

Building presentIQ taught me that an AI application is more than “connect a model to a frontend.”

The hard questions are:

- What should actually be measured?
- How reliable is each signal?
- How should different signals be combined?
- How do you turn raw model output into useful human feedback?

Working with speech, language, and computer vision also showed how much more powerful AI becomes when multiple modalities focus on one clear problem.

Most importantly, I learned to make pragmatic engineering decisions under real constraints while keeping the full application functional and reproducible locally.

---

## What’s Next?

Future versions could include:

- More detailed body-language analysis
- Improved gesture detection
- Pacing and pause analysis
- Filler-word detection
- Advanced language analysis
- Personalised presentation recommendations
- Presentation history & progress tracking
- Session comparison
- More advanced scoring
- Fully hosted production backend

**Long-term vision — a continuous training loop:**

```
        ┌──────────┐
        │ PRACTISE │
        └────┬─────┘
             ↓
        ┌──────────┐
        │ ANALYSE  │
        └────┬─────┘
             ↓
        ┌──────────┐
        │ FEEDBACK │
        └────┬─────┘
             ↓
        ┌──────────┐
        │ IMPROVE  │
        └────┬─────┘
             │
             └──────────→ PRACTISE AGAIN
```

---

## Contributing

Open to collaboration.

If you care about inclusive education, accessibility, AI, speech analysis, or computer vision — contributions are welcome.

1. Fork the repository
2. Create a feature branch  
   ```bash
   git checkout -b feature/your-idea
   ```
3. Make your changes
4. Commit  
   ```bash
   git commit -m "Add your feature"
   ```
5. Push  
   ```bash
   git push origin feature/your-idea
   ```
6. Open a pull request

Issues, ideas, and feedback are all welcome.

---

## Built for FirstCommit 2026

presentIQ was built during **FirstCommit 2026** as a solo project exploring AI, computer vision, inclusive education, and presentation coaching.

It was an opportunity to work across speech recognition, computer vision, web development, backend APIs, and AI-powered feedback — taking an idea from concept to a working application.

---

<div align="center">

**Author**

**Adeiza Onimisi Adeolu**

[@Reabot6](https://github.com/Reabot6) · onimisiadeolu@gmail.com

---

License · See the repository for licensing information

</div>
