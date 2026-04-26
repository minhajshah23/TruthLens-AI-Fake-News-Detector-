/* ============================================================
       FRONTEND SCRIPT
       No API keys here — all requests go to /api/analyze
       which is handled by our secure Netlify backend function.
    ============================================================ */

    const el = {
        input:        document.getElementById('claimInput'),
        analyzeBtn:   document.getElementById('analyzeBtn'),
        wordCount:    document.getElementById('wordCount'),
        errorMsg:     document.getElementById('errorMsg'),
        loading:      document.getElementById('loading'),
        loadStatus:   document.getElementById('loadingStatus'),
        progress:     document.getElementById('progressFill'),
        results:      document.getElementById('results'),
        scoreBadge:   document.getElementById('scoreBadge'),
        scoreNumber:  document.getElementById('scoreNumber'),
        verdictLabel: document.getElementById('verdictLabel'),
        verdictDesc:  document.getElementById('verdictDesc'),
        reasonsList:  document.getElementById('reasonsList'),
        signalsList:  document.getElementById('signalsList'),
        sourceGrid:   document.getElementById('sourceGrid'),
        sourceCount:  document.getElementById('sourceCount'),
        themeToggle:  document.getElementById('themeToggle'),
        themeIcon:    document.getElementById('themeIcon'),
    };

    /* ── Theme ── */
    const SUN  = `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;
    const MOON = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;

    function applyTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
        el.themeIcon.innerHTML = t === 'dark' ? SUN : MOON;
        localStorage.setItem('tl-theme', t);
    }
    applyTheme(localStorage.getItem('tl-theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'));
    el.themeToggle.addEventListener('click', () => {
        applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    /* ── Word count ── */
    el.input.addEventListener('input', () => {
        hideError();
        const w = el.input.value.trim().split(/\s+/).filter(Boolean).length;
        el.wordCount.textContent = w + ' word' + (w !== 1 ? 's' : '');
    });
    el.input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); startAnalysis(); }
    });
    el.analyzeBtn.addEventListener('click', startAnalysis);

    /* ── Helpers ── */
    function showError(msg) { el.errorMsg.textContent = msg; el.errorMsg.classList.add('visible'); }
    function hideError()    { el.errorMsg.classList.remove('visible'); }
    function setProgress(pct, msg) { el.progress.style.width = pct + '%'; if (msg) el.loadStatus.textContent = msg; }
    function showLoading()  { el.loading.classList.add('visible'); }
    function hideLoading()  { el.loading.classList.remove('visible'); }
    function sleep(ms)      { return new Promise(r => setTimeout(r, ms)); }

    /* ── Heuristics (local, no API) ── */
    function runHeuristics(text) {
        const flags = [];
        if (text.length < 30)
            flags.push({ type: 'yellow', msg: 'Very short claim — limited context.' });

        const caps = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
        if (caps > 2)
            flags.push({ type: 'yellow', msg: 'Aggressive capitalization detected (' + caps + ' words).' });

        const spam = ['urgent','viral','share now','100% true','breaking','exposed'];
        const hit  = spam.find(w => text.toLowerCase().includes(w));
        if (hit)
            flags.push({ type: 'red', msg: 'Sensational language found: "' + hit + '".' });

        if (/[!?]{3,}/.test(text))
            flags.push({ type: 'yellow', msg: 'Excessive punctuation detected.' });

        if (flags.length === 0) {
            flags.push({ type: 'green', msg: 'Tone is neutral — no inflammatory language.' });
            flags.push({ type: 'green', msg: 'Formatting appears normal.' });
        }
        return flags;
    }

    /* ── Scoring ── */
    function scoreFromVerdict(v) {
        v = (v || '').toLowerCase().trim();
        if (v === 'true')      return 90;
        if (v === 'false')     return 5;
        if (v === 'uncertain') return 48;
        if (v.includes('mostly true'))    return 78;
        if (v.includes('partially true')) return 55;
        if (v.includes('mostly false'))   return 18;
        if (v.includes('false'))          return 5;
        if (v.includes('true'))           return 85;
        return 48;
    }

    /* ── Verdict tiers ── */
    function getTier(s) {
        if (s >= 85) return { label:'Verified Fact',      desc:'Strongly supported by evidence.',       g:['#00c07a','#00d4c8'], sh:'rgba(0,192,122,0.3)'  };
        if (s >= 70) return { label:'Likely True',        desc:'Good consensus — minor gaps possible.',  g:['#22c55e','#4ade80'], sh:'rgba(34,197,94,0.3)'  };
        if (s >= 55) return { label:'Plausible',          desc:'Partially supported.',                   g:['#3b82f6','#60a5fa'], sh:'rgba(59,130,246,0.3)' };
        if (s >= 35) return { label:'Disputed',           desc:'Conflicting or insufficient evidence.',  g:['#f0b429','#fcd34d'], sh:'rgba(240,180,41,0.3)' };
        if (s >= 15) return { label:'Misleading',         desc:'Contains false or distorted elements.',  g:['#f97316','#fb923c'], sh:'rgba(249,115,22,0.3)' };
        return         { label:'Likely False / Fake',   desc:'Contradicts known facts.',                g:['#ef4444','#f87171'], sh:'rgba(239,68,68,0.3)'  };
    }

    /* ── Counter animation ── */
    function animateCounter(domEl, target) {
        const start = performance.now();
        (function step(now) {
            const p = Math.min((now - start) / 1200, 1);
            domEl.textContent = Math.round((1 - Math.pow(1-p,3)) * target);
            if (p < 1) requestAnimationFrame(step);
        })(start);
    }

    /* ── SVG icons ── */
    const checkSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    const warnSvg  = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    const extSvg   = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

    /* ── Display results ── */
    function displayResults(data, heuristics) {
        const score = scoreFromVerdict(data.verdict);
        const tier  = getTier(score);

        el.scoreBadge.style.background = 'linear-gradient(135deg,' + tier.g[0] + ',' + tier.g[1] + ')';
        el.scoreBadge.style.boxShadow  = '0 8px 32px ' + tier.sh;
        animateCounter(el.scoreNumber, score);
        el.verdictLabel.textContent = tier.label;
        el.verdictDesc.textContent  = tier.desc;

        // AI reasons
        el.reasonsList.innerHTML = (data.reasons || []).map(r =>
            '<li class="item"><div class="item-icon purple">' + checkSvg + '</div><span>' + r + '</span></li>'
        ).join('');

        // Heuristic signals
        el.signalsList.innerHTML = heuristics.map(f =>
            '<li class="item"><div class="item-icon ' + f.type + '">' + (f.type === 'green' ? checkSvg : warnSvg) + '</div><span>' + f.msg + '</span></li>'
        ).join('');

        // Sources
        if (data.sources && data.sources.length > 0) {
            el.sourceCount.textContent = data.sources.length + ' found' + (data.keyUsed ? ' (Key ' + data.keyUsed + ')' : '');
            el.sourceGrid.innerHTML = data.sources.map(s =>
                '<a href="' + s.url + '" target="_blank" rel="noopener" class="source-chip ' + (s.isTrusted ? 'trusted' : '') + '">' +
                '<img src="https://www.google.com/s2/favicons?domain=' + s.domain + '&sz=32" class="favicon" alt="" onerror="this.style.display=\'none\'">' +
                '<span>' + s.domain + '</span>' + extSvg + '</a>'
            ).join('');
        } else {
            el.sourceCount.textContent = data.groqOnly ? 'Groq-only mode' : '0 found';
            el.sourceGrid.innerHTML = '<span class="no-sources">' +
                (data.groqOnly
                    ? '⚠️ All Tavily search keys are currently exhausted. Analysis uses Groq AI knowledge only (up to early 2024). Keys reset monthly.'
                    : 'No web sources returned for this query.') +
                '</span>';
        }

        el.results.classList.add('visible');
        document.querySelectorAll('.item').forEach((item, i) => {
            setTimeout(() => item.classList.add('show'), 80 + i * 60);
        });
        setTimeout(() => el.results.scrollIntoView({ behavior:'smooth', block:'start' }), 100);
    }

    /* ── Main analysis flow ── */

    // 5 second cooldown after each analysis to prevent rapid clicking.
    const COOLDOWN_MS = 5000;
    let cooldownEnd   = 0;
    let cooldownTimer = null;

    const BTN_DEFAULT_HTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
        Run Analysis`;

    function startCooldown() {
        cooldownEnd = Date.now() + COOLDOWN_MS;
        el.analyzeBtn.disabled = true;

        if (cooldownTimer) clearInterval(cooldownTimer);

        cooldownTimer = setInterval(() => {
            const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
            if (remaining <= 0) {
                clearInterval(cooldownTimer);
                el.analyzeBtn.disabled = false;
                el.analyzeBtn.innerHTML = BTN_DEFAULT_HTML;
            } else {
                // Show live countdown on the button
                el.analyzeBtn.innerHTML = `⏳ Wait ${remaining}s`;
            }
        }, 500);
    }

    async function startAnalysis() {
        const text = el.input.value.trim();

        // Block if still in cooldown
        if (Date.now() < cooldownEnd) {
            const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
            showError(`Please wait ${remaining} more second${remaining !== 1 ? 's' : ''} before running another analysis.`);
            return;
        }

        hideError();
        const wc = text.split(/\s+/).filter(Boolean).length;
        if (wc === 0) { el.input.classList.add('shake'); el.input.focus(); return; }
        if (wc < 2)   { showError('Please enter a full claim or sentence.'); el.input.classList.add('shake'); return; }

        const heuristics = runHeuristics(text);

        el.results.classList.remove('visible');
        showLoading();
        el.analyzeBtn.disabled = true;

        try {
            setProgress(15, 'Checking language signals...');
            await sleep(200);

            setProgress(35, 'Searching the web for evidence...');

            // The only network call — hits our secure Netlify backend, not Groq/Tavily directly
            const response = await fetch('/api/analyze', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ claim: text }),
            });

            setProgress(80, 'Building verdict...');

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(err.error || 'Server error ' + response.status);
            }

            const data = await response.json();
            setProgress(100, 'Done!');
            await sleep(150);

            displayResults(data, heuristics);

        } catch (err) {
            console.error('[TruthLens]', err);
            showError(err.message || 'Analysis failed. Please try again.');
        } finally {
            hideLoading();
            setProgress(0, '');
            // Always start cooldown — whether it succeeded or failed
            startCooldown();
        }
    }