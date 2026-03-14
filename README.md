# 🔍 TruthLens: AI-Powered Fake News Detector

## 📖 Overview
TruthLens is a web-based artificial intelligence application designed to analyze and verify the credibility of news articles and online claims. By cross-referencing user inputs against real-time web data and processing the context through a Large Language Model, TruthLens provides an immediate, AI-driven credibility assessment to combat misinformation.

## ✨ Key Features
* **Real-Time Web Retrieval:** Fetches up-to-date context and sources for any given claim.
* **AI Credibility Analysis:** Evaluates the retrieved data against the original claim to detect bias, missing context, or factual inaccuracies.
* **Responsive Web Interface:** A clean, accessible frontend for seamless user interaction.

## 🛠️ Tech Stack
* **Frontend:** HTML, CSS, JavaScript
* **LLM Inference:** Groq API 
* **Search / Retrieval:** Tavily API 

## 👥 Team
* **Arsalan Asghar**
* **Minhaj Shah**
* ## ⚙️ Setup & Installation
1. Clone the repository to your local machine.
2. Open the `index.html` file in any modern web browser.
3. *Note: You will need to supply your own active Groq and Tavily API keys to run the analysis.*

---

# ⚠️ Developer Notice (For Future Me)

## 📌 Project Dependency Warning

This project was built using free-tier API access for:

* **Groq** — LLM inference
* **Tavily** — Search / Retrieval API

If this application stops functioning in the future, the most likely causes are:

* Expired API keys
* Free-tier usage limits exceeded
* Provider policy changes
* Free plan discontinued

Before debugging frontend logic, always verify API status and key validity first.

---

## 🔐 API Key Handling Strategy

API keys were stored in the frontend and protected using a **JavaScript scramble / unscramble obfuscation technique**.

### Important Clarifications

* This is **not encryption**
* This does **not** provide real security
* It only prevents casual inspection
* Skilled users can reverse it

This approach was acceptable for a prototype / academic demonstration, but it is **not production-safe**.

---

## 🚀 Production Upgrade Path

If this project is ever deployed publicly or scaled:

* Move all API calls to a backend server
* Store API keys using environment variables
* Implement rate limiting
* Add proper authentication
* Remove all client-side key exposure

---

## 🔄 If APIs Stop Working

If either API provider becomes unavailable:

* Replace the LLM provider with an alternative
* Replace the search API with another service
* Or implement a backend proxy architecture

The system architecture supports replacement without major redesign.

---

## 📌 Final Reminder

If the system breaks unexpectedly, check API keys and provider limits first.

It is most likely an API issue — not a frontend bug.
