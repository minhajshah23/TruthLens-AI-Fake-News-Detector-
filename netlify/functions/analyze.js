/**
 * TruthLens PRO — Netlify Backend Function
 * File location: netlify/functions/analyze.js
 *
 * Uses exports.handler — the correct format for Netlify Functions.
 * API keys are read from Netlify environment variables (never in code).
 *
 * Protection built in:
 *  - Rate limiting: max 5 requests per IP per 10 minutes
 *  - Claim length limit: max 1000 characters
 *  - Method check: only POST allowed
 */

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const TAVILY_URL = 'https://api.tavily.com/search';

const TRUSTED_DOMAINS = [
    'dawn.com', 'geo.tv', 'bbc.com', 'reuters.com', 'aljazeera.com',
    'cnn.com', 'nytimes.com', 'tribune.com.pk', 'thenews.com.pk',
    'apnews.com', 'bloomberg.com', 'gov.pk', 'wikipedia.org', 'un.org',
    'theguardian.com', 'washingtonpost.com', 'economist.com'
];

// CORS headers — required so the browser allows the frontend to call this
const HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
};

/* ============================================================
   RATE LIMITER
   Tracks how many requests each IP has made.
   Stored in memory — resets when the function cold-starts.
   Limit: 5 requests per IP per 10 minutes.
   This prevents a single user from draining all API credits.
============================================================ */
const rateLimitStore = new Map();
const RATE_LIMIT     = 5;               // max requests per window
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

function isRateLimited(ip) {
    const now  = Date.now();
    const data = rateLimitStore.get(ip) || { count: 0, windowStart: now };

    // Reset window if 10 minutes have passed
    if (now - data.windowStart > RATE_WINDOW_MS) {
        data.count       = 0;
        data.windowStart = now;
    }

    data.count++;
    rateLimitStore.set(ip, data);

    // Clean up old IPs to prevent memory buildup
    if (rateLimitStore.size > 500) {
        for (const [key, val] of rateLimitStore) {
            if (now - val.windowStart > RATE_WINDOW_MS) rateLimitStore.delete(key);
        }
    }

    return data.count > RATE_LIMIT;
}

/* ============================================================
   MAIN HANDLER
   Netlify calls this on every request to /api/analyze
============================================================ */
exports.handler = async function (event) {

    // Handle browser preflight CORS request
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: HEADERS, body: '' };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return respond({ error: 'Method not allowed.' }, 405);
    }

    // ── Rate limiting ──────────────────────────────────────
    const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || event.headers['client-ip']
            || 'unknown';

    if (isRateLimited(ip)) {
        console.warn('[TruthLens] Rate limit hit for IP:', ip);
        return respond({
            error: 'Too many requests. You have used your limit of 5 analyses per 10 minutes. Please wait and try again.'
        }, 429);
    }

    // ── Read API keys from Netlify environment variables ───
    // These names must EXACTLY match what you set in Netlify dashboard
    const GROQ_KEY     = process.env.GROQ_KEY;
    const TAVILY_KEY_1 = process.env.TAVILY_KEY_1;
    const TAVILY_KEY_2 = process.env.TAVILY_KEY_2;
    const TAVILY_KEY_3 = process.env.TAVILY_KEY_3;

    if (!GROQ_KEY) {
        console.error('[TruthLens] GROQ_KEY environment variable is not set.');
        return respond({ error: 'Server configuration error. Contact the site admin.' }, 500);
    }

    // ── Parse request body ─────────────────────────────────
    let claim;
    try {
        const body = JSON.parse(event.body || '{}');
        claim = (body.claim || '').trim();
    } catch {
        return respond({ error: 'Invalid request format.' }, 400);
    }

    // ── Validate claim ─────────────────────────────────────
    if (!claim || claim.split(/\s+/).filter(Boolean).length < 2) {
        return respond({ error: 'Claim is too short. Please enter a full sentence.' }, 400);
    }

    if (claim.length > 1000) {
        return respond({ error: 'Claim is too long. Maximum 1000 characters.' }, 400);
    }

    // ── Step 1: Tavily web search (3-key fallback) ─────────
    const tavilyKeys   = [TAVILY_KEY_1, TAVILY_KEY_2, TAVILY_KEY_3].filter(Boolean);
    const searchResult = await searchWeb(claim, tavilyKeys);

    // ── Step 2: Groq AI analysis ───────────────────────────
    let aiResult;
    try {
        aiResult = await callGroq(claim, searchResult?.context || null, GROQ_KEY);
    } catch (err) {
        console.error('[TruthLens] Groq failed:', err.message);
        return respond({ error: 'AI analysis failed. Please try again in a moment.' }, 502);
    }

    // ── Step 3: Return results to frontend ─────────────────
    return respond({
        verdict:  aiResult.verdict,
        reasons:  aiResult.reasons  || [],
        sources:  searchResult?.sources || [],
        keyUsed:  searchResult?.keyUsed || null,
        groqOnly: !searchResult,
    });
};

/* ============================================================
   TAVILY WEB SEARCH — 3-key fallback chain
   Tries Key 1 → Key 2 → Key 3.
   Skips a key on 401 (expired) or 429 (limit hit).
   Returns null if all keys fail → Groq runs on knowledge only.
============================================================ */
async function searchWeb(query, keys) {
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!key) continue;

        console.log('[TruthLens] Trying Tavily key ' + (i + 1) + '...');

        try {
            const res = await fetch(TAVILY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_key:        key,
                    query:          query.substring(0, 300),
                    search_depth:   'basic',
                    include_answer: false,
                    max_results:    6,
                }),
            });

            if (res.status === 401 || res.status === 429) {
                console.warn('[TruthLens] Tavily key ' + (i + 1) + ' rejected (' + res.status + ') — trying next.');
                continue;
            }

            if (!res.ok) {
                console.warn('[TruthLens] Tavily key ' + (i + 1) + ' error (' + res.status + ') — trying next.');
                continue;
            }

            const data = await res.json();

            if (!data.results || data.results.length === 0) {
                return { context: '', sources: [], keyUsed: i + 1 };
            }

            let context = '';
            const sources = [];

            for (const result of data.results) {
                const isTrusted = TRUSTED_DOMAINS.some(d => result.url.includes(d));
                context += (isTrusted ? '[TRUSTED]' : '[GENERAL]')
                    + ' "' + result.title + '" — '
                    + result.content.substring(0, 250)
                    + ' (' + result.url + ')\n';

                try {
                    sources.push({
                        title:     result.title,
                        url:       result.url,
                        domain:    new URL(result.url).hostname.replace('www.', ''),
                        isTrusted: isTrusted,
                    });
                } catch (_) {}
            }

            console.log('[TruthLens] Tavily key ' + (i + 1) + ' succeeded — ' + sources.length + ' results.');
            return { context, sources, keyUsed: i + 1 };

        } catch (networkErr) {
            console.warn('[TruthLens] Tavily key ' + (i + 1) + ' network error:', networkErr.message);
        }
    }

    console.warn('[TruthLens] All Tavily keys exhausted — Groq-only mode.');
    return null;
}

/* ============================================================
   GROQ AI ANALYSIS
============================================================ */
async function callGroq(claim, webContext, groqKey) {
    const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const hasWeb = webContext && webContext.trim().length > 0;

    const systemPrompt =
        'You are TruthLens Pro, a strict fact-checking AI. Today\'s date is ' + today + '.\n\n'
        + (hasWeb
            ? '⚠️ LIVE WEB SEARCH RESULTS ARE PROVIDED BELOW.\n'
            + 'YOUR TRAINING DATA IS OUTDATED — web results below are current and accurate.\n'
            + 'You MUST base your verdict on the web results, NOT your training data.\n'
            + 'If web results contradict your training knowledge, ALWAYS trust the web results.\n'
            + 'Example: if your training says Biden is president but web says Trump won 2024 → trust web.\n\n'
            + 'SEARCH RESULTS:\n' + webContext + '\n---\n\n'
            : '⚠️ No live web data available. Use training knowledge but note cutoff is early 2024.\n\n')
        + 'Return ONLY a valid JSON object. No extra text. No markdown. No code fences.\n\n'
        + 'RULES for "reasons":\n'
        + '- Exactly 3 short, direct factual conclusions. Max 12 words each.\n'
        + '- State facts from web results above. Never say "search results show".\n'
        + '- Never repeat or paraphrase the claim.\n'
        + '- Never show step-by-step reasoning — conclusion only.\n\n'
        + 'RULES for "verdict":\n'
        + '- Use EXACTLY one of: "True", "False", "Uncertain"\n'
        + '- "True"      = claim is correct per web results.\n'
        + '- "False"     = claim contradicts web results OR is a future unconfirmed event.\n'
        + '- "Uncertain" = ONLY if web results have zero relevant info.\n'
        + '- FUTURE EVENTS RULE: If something has not happened yet as of today → verdict = "False".\n'
        + '- Reasons MUST match verdict. Never contradict yourself.\n\n'
        + 'Output format:\n'
        + '{ "verdict": "True", "reasons": ["Fact one.", "Fact two.", "Fact three."] }';

    const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + groqKey,
            'Content-Type':  'application/json',
        },
        body: JSON.stringify({
            model:           GROQ_MODEL,
            temperature:     0.0,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: 'Claim to verify: "' + claim + '"' },
            ],
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error('Groq API ' + res.status + ': ' + body);
    }

    const data   = await res.json();
    const raw    = data.choices?.[0]?.message?.content || '{}';
    const clean  = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    console.log('[TruthLens] Groq verdict:', parsed.verdict);
    return parsed;
}

/* ============================================================
   HELPER — builds a JSON response with correct headers
============================================================ */
function respond(data, status = 200) {
    return {
        statusCode: status,
        headers:    HEADERS,
        body:       JSON.stringify(data),
    };
}
