# TruthLens PRO 🔍

> AI-powered credibility analysis for news & claims

# Link
> truthlens-ai-fake-news-detector.netlify.app

---

## What is TruthLens PRO?

TruthLens PRO is an AI-powered fake news and misinformation detector. Paste any news headline, article excerpt, or claim — and TruthLens will analyze it in real time, giving you a credibility score, AI reasoning, and live web sources to back it up.

Built to help people think critically before sharing content online.

---

## Features

- **Credibility Score** — Every claim gets a score from 0 to 100, indicating how credible it is based on available evidence.
- **AI Reasoning** — Powered by [Groq](https://groq.com/), the AI explains *why* a claim is credible or not, in plain language.
- **Web Source Detection** — Uses [Tavily Search API](https://tavily.com/) to find and surface real web sources relevant to the claim.
- **Signal Detection** — Identifies linguistic and contextual signals that are commonly associated with misinformation.
- **Secure API Handling** — All API keys (Groq + Tavily) are stored securely in Netlify's backend environment variables — never exposed to the client.
- **Fast & Lightweight** — Pure HTML/CSS/JS frontend with no heavy frameworks.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| AI Reasoning | [Groq API](https://groq.com/) |
| Web Search | [Tavily Search API](https://tavily.com/) |
| Backend / Serverless Functions | [Netlify Functions](https://docs.netlify.com/functions/overview/) |
| Hosting | [Netlify](https://www.netlify.com/) |
| Source Control | GitHub |

---

## How It Works

1. User pastes a news claim or article text into the input field.
2. The frontend sends the text to a **Netlify serverless function** (backend).
3. The function calls the **Tavily API** to search the web for relevant sources.
4. It then calls the **Groq API** with the claim + sources to generate an AI credibility analysis.
5. The result — score, reasoning, and sources — is returned to the frontend and displayed.

> API keys are stored as **Netlify environment variables** and are never sent to or visible in the browser.

---

## Security

This project handles API keys responsibly:

- Groq and Tavily API keys live **only** in Netlify's environment variable settings.
- All requests to external APIs are made through **Netlify Functions** (serverless backend), not from the browser.
- The frontend never sees or touches any API key.

---

## Built By

- [Arsalan Asghar](https://truthlens-ai-fake-news-detector.netlify.app/arsalan)
- [Minhaj Shah](https://truthlens-ai-fake-news-detector.netlify.app/minhaj)

---

## Disclaimer

TruthLens PRO provides AI-generated credibility estimates. Always verify important claims with primary sources before sharing. This tool is meant to assist critical thinking, not replace it.

---

*Powered by Groq AI + Tavily Search · Hosted on Netlify*
