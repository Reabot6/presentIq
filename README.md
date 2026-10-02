<div align="center">
                                    _   ___ ___
 _ __  _ __ ___  ___  ___ _ __ | |_|_ _/ _ \
| '_ \| '__/ _ \/ __|/ _ \ '_ \| __|| | | | |
| |_) | | |  __/\__ \  __/ | | | |_ | | |_| |
| .__/|_|  \___||___/\___|_| |_|\__|___\__\_\
|_|

An AI coach for people who struggle with presenting.

</div>

⸻

What is presentIQ?

Presenting is hard.

For many people, presentations can become a barrier in school, interviews, pitches, and the workplace. Most people only receive meaningful feedback after the presentation is already over.

presentIQ is an AI presentation coach designed to let people practise privately and receive feedback before the stakes are high.

It listens to what you say, observes how you deliver it, and analyses different aspects of your presentation to help you understand what you’re doing well and what you can improve.

I built presentIQ with inclusive education in mind — giving people who struggle with presenting a private, judgement-free environment to practise at their own pace.

⸻

How It Works

   ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
   │   QUIZ    │ → │  RECORD   │ → │  ANALYSE  │ → │  FEEDBACK │
   └───────────┘   └───────────┘   └───────────┘   └───────────┘

1. Quiz

Users can take a short pre-presentation quiz to test their understanding of the material they are about to present.

2. Record

The user records their presentation through the application.

3. Analyse

presentIQ processes the recording using multiple analysis systems, including speech recognition, language analysis, and computer vision.

4. Feedback

The different signals are combined into feedback that highlights strengths and areas for improvement.

⸻

Features

🎯 Pre-presentation Quiz

Checks whether the presenter understands their material before they begin.

🎙️ Speech Analysis

Uses OpenAI Whisper to transcribe the presentation and provide speech data for further analysis.

👁️ Computer Vision

Analyses visual aspects of the presentation, including presentation behaviour and physical delivery.

👐 Gesture & Posture Analysis

Identifies and analyses gestures, posture, and other aspects of body language.

📝 Language Analysis

Analyses the words and phrasing used during the presentation.

💡 Actionable Feedback

Transforms the analysis into feedback designed to help the presenter understand what to improve.

⸻

Tech Stack

Layer	Technology
Frontend	React, Vite, JavaScript
Styling	HTML, CSS
Backend	Python, FastAPI
Speech Recognition	OpenAI Whisper
Computer Vision	Computer Vision
Language Analysis	Groq / AI
API Communication	REST

⸻

Project Structure

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

The project is separated into a React/Vite frontend and a Python/FastAPI backend.

⸻

Live Preview

A hosted version of the frontend experience is available here:

Open presentIQ Live Preview

Note: The hosted preview currently represents the frontend experience.

The complete application includes a backend responsible for processing presentation data, speech, language, and computer-vision analysis.

⸻

Running the Full Application Locally

The complete presentIQ application can be run locally from the repository.

Prerequisites

Make sure you have:

* Git
* Node.js
* npm
* Python 3.x
* pip

1. Clone the repository

git clone https://github.com/Reabot6/presentIq.git
cd presentIq

2. Start the Backend

cd presentiq-backend

Create and activate a Python virtual environment:

python -m venv venv

Windows

venv\Scripts\activate

macOS / Linux

source venv/bin/activate

Install the Python dependencies:

pip install -r requirements.txt

Create the environment file:

cp .env.example .env

Add the required API credentials to .env.

Then start the FastAPI server using the project’s configured entry point.

For example:

uvicorn main:app --reload

If the backend entry file or FastAPI application object uses a different name, use the corresponding command from the backend source.

3. Start the Frontend

Open a second terminal:

cd presentIq/presentiq-frontend

Install the frontend dependencies:

npm install

Start the Vite development server:

npm run dev

Vite will provide a local URL, typically:

http://localhost:5173

Open that URL in your browser.

⸻

Environment Variables

The backend requires API credentials for its AI services.

Create a .env file inside:

presentiq-backend/

using:

cp .env.example .env

Then add the required credentials.

Important

Never commit your .env file or expose API keys publicly.

The exact Groq environment variable names should match the variables referenced by the backend’s Groq client implementation.

⸻

Why Isn’t the Full Backend Hosted?

I wanted to provide a live deployment, but the backend requires server-side processing resources for the AI and computer-vision pipeline.

During the hackathon, the free hosting options I evaluated either had usage limitations or were only available for a limited period. Rather than deploy a backend that could become unavailable or unreliable, I kept the complete application runnable locally and provided a hosted frontend preview for judges.

The public GitHub repository contains the full source code required to run the application locally.

⸻

Screenshots

<!-- Add screenshots or a demo GIF here -->

Presentation Workflow

Quiz
  ↓
Record Presentation
  ↓
Speech + Vision Analysis
  ↓
Language Analysis
  ↓
Personalised Feedback

⸻

Challenges

One of my biggest challenges was turning something subjective like “good presenting” into measurable signals.

A presentation isn’t just about the words being spoken. Delivery also involves pacing, gestures, posture, body language, and word choice.

I had to think about how to analyse these different signals independently and combine them into feedback without overwhelming the user with meaningless numbers.

Another challenge was processing recorded audio and video while connecting several different analysis systems into one workflow.

Finally, deployment was a challenge because the backend requires resources that weren’t practical to maintain on the free hosting options available to me during the hackathon.

⸻

What I Learned

Building presentIQ taught me that building an AI application isn’t simply about connecting an AI model to a frontend.

The difficult part is determining:

* What should actually be measured?
* How reliable is each signal?
* How should different signals be combined?
* How do I turn raw model output into useful human feedback?

Working with speech, language, and computer vision also showed me how much more useful AI can become when multiple modalities are combined around one specific problem.

Most importantly, I learned how to make pragmatic engineering decisions under real constraints while still keeping the complete application functional and reproducible locally.

⸻

What’s Next?

Future versions of presentIQ could include:

* More detailed body-language analysis
* Improved gesture detection
* Pacing and pause analysis
* Filler-word detection
* More advanced language analysis
* Personalised presentation recommendations
* Presentation history
* Progress tracking
* Comparison between practice sessions
* More advanced presentation scoring
* A fully hosted production backend

The long-term goal is to create a continuous presentation training loop:

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

⸻

Contributing

Open to collaboration.

If you’re interested in inclusive education, accessibility, AI, speech analysis, or computer vision, contributions are welcome.

1. Fork the repository.
2. Create a feature branch:

git checkout -b feature/your-idea

3. Make your changes.
4. Commit:

git commit -m "Add your feature"

5. Push your branch:

git push origin feature/your-idea

6. Open a pull request.

Issues, ideas, and feedback are welcome.

⸻

Built for FirstCommit 2026

I built presentIQ during FirstCommit 2026 as a solo project exploring AI, computer vision, inclusive education, and presentation coaching.

The project gave me the opportunity to work across speech recognition, computer vision, web development, backend APIs, and AI-powered feedback while taking an idea from concept to a working application.

⸻

Author

Adeiza Onimisi Adeolu

@Reabot6 · onimisiadeolu@gmail.com

⸻

License

See the repository for licensing information.
