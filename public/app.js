const $ = (id) => document.getElementById(id);
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const LISTENING_TASKS = new Set(["repeat-sentence", "retell-lecture", "answer-short-question"]);
const HISTORY_KEY = "pte-history";

let TASKS = {};
let QUESTIONS = [];
let currentTask = null;
let currentIndex = 0;
let session = null; // state for the attempt in progress

init();

async function init() {
  if (!SpeechRecognition) $("support-warning").hidden = false;
  const res = await fetch("/api/tasks");
  ({ tasks: TASKS, questions: QUESTIONS } = await res.json());

  const list = $("task-list");
  for (const [key, task] of Object.entries(TASKS)) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = task.name;
    btn.dataset.task = key;
    btn.onclick = () => selectTask(key);
    li.append(btn);
    list.append(li);
  }

  try {
    const accent = localStorage.getItem("pte-accent");
    if (accent) $("accent").value = accent;
  } catch {}
  $("accent").onchange = () => {
    try { localStorage.setItem("pte-accent", $("accent").value); } catch {}
  };

  $("prev").onclick = () => showQuestion(currentIndex - 1);
  $("next").onclick = () => showQuestion(currentIndex + 1);
  $("start").onclick = startAttempt;
  $("skip-prep").onclick = () => session?.skipPrep?.();
  $("stop").onclick = () => session?.finish?.();
  $("retry").onclick = () => showQuestion(currentIndex);
  $("submit").onclick = submit;
  $("clear-history").onclick = () => {
    try { localStorage.removeItem(HISTORY_KEY); } catch {}
    renderHistory();
  };
  renderHistory();
}

function questionsFor(task) {
  return QUESTIONS.filter((q) => q.task === task);
}

function selectTask(task) {
  currentTask = task;
  document.querySelectorAll("#task-list button").forEach((b) => b.classList.toggle("active", b.dataset.task === task));
  $("welcome").hidden = true;
  showQuestion(0);
}

function showQuestion(index) {
  cancelSession();
  const qs = questionsFor(currentTask);
  currentIndex = (index + qs.length) % qs.length;
  const q = qs[currentIndex];
  const task = TASKS[currentTask];

  $("question").hidden = false;
  $("result").hidden = true;
  $("q-task").textContent = task.name;
  $("q-counter").textContent = `Question ${currentIndex + 1} of ${qs.length}`;
  $("q-instructions").textContent = task.instructions;
  $("q-body").innerHTML = "";
  $("transcript-wrap").hidden = true;
  $("transcript").value = "";
  $("playback").hidden = true;
  $("submit").hidden = true;
  setButtons({ start: true });
  setStatus("Press Start when you're ready", "", 0);

  if (LISTENING_TASKS.has(currentTask)) {
    $("q-body").innerHTML = `<div class="listen-box">🎧 <span>The audio plays when you press Start${
      q.title ? ` — <b>${escapeHtml(q.title)}</b>` : ""
    }.</span></div>`;
  }
}

function setButtons({ start = false, skip = false, stop = false, retry = false }) {
  $("start").hidden = !start;
  $("skip-prep").hidden = !skip;
  $("stop").hidden = !stop;
  $("retry").hidden = !retry;
}

function setStatus(label, time, fraction, recording = false) {
  $("status-label").textContent = label;
  $("status-label").classList.toggle("recording", recording);
  $("status-time").textContent = time;
  $("progress-bar").style.width = `${Math.min(100, fraction * 100)}%`;
  $("progress-bar").classList.toggle("recording", recording);
}

function currentQuestion() {
  return questionsFor(currentTask)[currentIndex];
}

async function startAttempt() {
  const q = currentQuestion();
  const task = TASKS[q.task];
  const s = (session = { cancelled: false, timers: [] });
  setButtons({});

  // Ask for the mic up front so the permission prompt doesn't eat recording time.
  try {
    s.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    setStatus("Microphone access was blocked. Allow it in your browser and try again.", "", 0);
    setButtons({ retry: true });
    return;
  }
  if (s.cancelled) return stopStream(s);

  if (q.task === "read-aloud") {
    $("q-body").innerHTML = `<div class="passage">${escapeHtml(q.text)}</div>`;
  } else if (q.task === "describe-image") {
    $("q-body").innerHTML = renderChart(q);
  } else {
    setStatus("Playing audio…", "", 0);
    $("q-body").querySelector(".listen-box span").textContent = "Listen carefully…";
    await speak(q.text, s);
    if (s.cancelled) return;
    $("q-body").querySelector(".listen-box span").textContent = "Audio finished.";
  }

  if (task.prep > 0) await countdown(s, "Preparation", task.prep, true);
  if (s.cancelled) return;
  await beep();
  if (s.cancelled) return;
  record(s, task.record);
}

function countdown(s, label, seconds, skippable) {
  return new Promise((resolve) => {
    const start = performance.now();
    const done = () => {
      clearInterval(timer);
      s.skipPrep = null;
      setButtons({});
      resolve();
    };
    const tick = () => {
      if (s.cancelled) return done();
      const left = seconds - (performance.now() - start) / 1000;
      if (left <= 0) return done();
      setStatus(label, `${Math.ceil(left)}s`, 1 - left / seconds);
    };
    const timer = setInterval(tick, 200);
    s.timers.push(timer);
    s.skipPrep = done;
    setButtons({ skip: skippable });
    tick();
  });
}

function record(s, maxSeconds) {
  const startedAt = performance.now();
  const chunks = [];
  s.recorder = new MediaRecorder(s.stream);
  s.recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  s.recorder.onstop = () => {
    const url = URL.createObjectURL(new Blob(chunks, { type: s.recorder.mimeType }));
    $("playback").src = url;
    $("playback").hidden = false;
  };
  s.recorder.start();

  $("transcript-wrap").hidden = false;
  $("transcript").readOnly = !!SpeechRecognition;
  s.speech = startRecognition(startedAt, (text) => ($("transcript").value = text));

  setButtons({ stop: true });
  const timer = setInterval(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    setStatus("Recording", `${Math.max(0, Math.ceil(maxSeconds - elapsed))}s left`, elapsed / maxSeconds, true);
    if (elapsed >= maxSeconds) s.finish();
  }, 200);
  s.timers.push(timer);

  s.finish = async () => {
    if (s.finished) return;
    s.finished = true;
    clearInterval(timer);
    s.durationSec = (performance.now() - startedAt) / 1000;
    if (s.recorder.state !== "inactive") s.recorder.stop();
    setButtons({});
    setStatus("Finishing transcript…", "", 1);
    s.delivery = await s.speech.stop();
    stopStream(s);
    s.delivery.durationSec = s.durationSec;
    $("transcript").value = s.delivery.transcript;
    $("transcript").readOnly = false;
    if (!s.delivery.transcript && SpeechRecognition) {
      $("transcript").placeholder = "No speech was recognised. Check your microphone, or type what you said.";
    }
    setStatus("Done — review your transcript, then get your score", "", 1);
    $("submit").hidden = false;
    setButtons({ retry: true });
  };
}

// Wraps the browser's speech recogniser and measures timing between bursts of words.
function startRecognition(startedAt, onText) {
  const state = { finals: [], interim: "", wordTimes: [], lastWords: 0, active: true };
  const empty = { transcript: "", onsetSec: 0, pauses: [], confidence: null, lowConfidenceWords: [] };
  if (!SpeechRecognition) return { stop: async () => empty };

  const rec = new SpeechRecognition();
  rec.lang = $("accent").value;
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  const fullText = () => [...state.finals.map((f) => f.text), state.interim].join(" ").replace(/\s+/g, " ").trim();

  rec.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) {
        state.finals.push({ text: r[0].transcript.trim(), confidence: r[0].confidence });
      } else {
        interim += r[0].transcript;
      }
    }
    state.interim = interim.trim();
    const text = fullText();
    const words = text ? text.split(" ").length : 0;
    if (words > state.lastWords) {
      state.wordTimes.push((performance.now() - startedAt) / 1000);
      state.lastWords = words;
    }
    onText(text);
  };
  // Chrome ends continuous recognition after a silence; keep it alive while recording.
  rec.onend = () => {
    if (state.active) {
      try { rec.start(); } catch {}
    } else {
      state.resolve?.();
    }
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") state.active = false;
  };
  rec.start();

  return {
    stop() {
      state.active = false;
      return new Promise((resolve) => {
        state.resolve = resolve;
        try { rec.stop(); } catch { resolve(); }
        setTimeout(resolve, 2500);
      }).then(() => {
        // Promote whatever was still interim when we stopped.
        if (state.interim) state.finals.push({ text: state.interim, confidence: null });
        state.interim = "";
        const scored = state.finals.filter((f) => typeof f.confidence === "number" && f.confidence > 0);
        const weight = (f) => f.text.split(/\s+/).length;
        const totalWeight = scored.reduce((a, f) => a + weight(f), 0);
        const pauses = state.wordTimes.slice(1).map((t, i) => round(t - state.wordTimes[i]));
        return {
          transcript: fullText(),
          onsetSec: state.wordTimes.length ? round(state.wordTimes[0]) : 0,
          pauses,
          confidence: totalWeight ? scored.reduce((a, f) => a + f.confidence * weight(f), 0) / totalWeight : null,
          lowConfidenceWords: scored.filter((f) => f.confidence < 0.75).flatMap((f) => f.text.split(/\s+/)),
        };
      });
    },
  };
}

function speak(text, s) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const lang = $("accent").value;
    const voice = speechSynthesis.getVoices().find((v) => v.lang === lang) ||
      speechSynthesis.getVoices().find((v) => v.lang.startsWith("en"));
    if (voice) u.voice = voice;
    u.lang = lang;
    u.rate = 0.95;
    u.onend = u.onerror = () => resolve();
    s.cancelSpeech = () => {
      speechSynthesis.cancel();
      resolve();
    };
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });
}

function beep() {
  return new Promise((resolve) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
      osc.onended = () => {
        ctx.close();
        resolve();
      };
    } catch {
      resolve();
    }
  });
}

function stopStream(s) {
  s.stream?.getTracks().forEach((t) => t.stop());
}

function cancelSession() {
  const s = session;
  if (!s) return;
  s.cancelled = true;
  s.timers.forEach(clearInterval);
  s.cancelSpeech?.();
  s.skipPrep?.();
  if (s.recorder && s.recorder.state !== "inactive") s.recorder.stop();
  if (s.speech && !s.finished) s.speech.stop();
  stopStream(s);
  session = null;
}

async function submit() {
  const q = currentQuestion();
  const s = session;
  const delivery = s?.delivery ?? { onsetSec: 0, pauses: [] };
  const transcript = $("transcript").value;
  // A typed or hand-edited transcript has no recogniser confidence to rely on.
  if (transcript.trim() !== (delivery.transcript || "").trim()) {
    delivery.confidence = null;
    delivery.lowConfidenceWords = [];
  }

  $("submit").disabled = true;
  const result = $("result");
  result.hidden = false;
  result.innerHTML = `<p><span class="spinner"></span>Scoring your answer… this usually takes 10–30 seconds.</p>`;
  result.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const res = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: q.id, transcript, delivery }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Scoring failed.");
    renderResult(q, data);
    saveHistory(q, data);
  } catch (err) {
    result.innerHTML = `<div class="notice error">${escapeHtml(err.message)}</div>`;
  } finally {
    $("submit").disabled = false;
  }
}

function level(fraction) {
  return fraction >= 0.75 ? "good" : fraction >= 0.45 ? "mid" : "low";
}

function renderResult(q, data) {
  const names = { content: "Content", oralFluency: "Oral fluency", pronunciation: "Pronunciation" };
  const traitHtml = Object.entries(data.max)
    .filter(([, max]) => max !== null)
    .map(([key, max]) => {
      const val = data.traits[key];
      const lvl = level(val / max);
      return `<div class="trait"><div class="name">${names[key]}</div>
        <div class="val lvl-${lvl}">${val}<span class="muted small"> / ${max}</span></div>
        <div class="bar"><span class="lvl-${lvl}-bg" style="width:${(val / max) * 100}%"></span></div></div>`;
    })
    .join("");

  const m = data.metrics;
  const metrics = [
    `Words <b>${m.wordCount}</b>`,
    `Speaking time <b>${m.durationSec}s</b>`,
    m.wordsPerMinute ? `Pace <b>${m.wordsPerMinute} wpm</b>` : "",
    `Started after <b>${m.onsetSec}s</b>`,
    `Pauses over 1s <b>${m.longPauses}</b>`,
    m.asrConfidence !== null ? `Recogniser confidence <b>${Math.round(m.asrConfidence * 100)}%</b>` : "",
  ].filter(Boolean).map((x) => `<span>${x}</span>`).join("");

  const f = data.feedback;
  const list = (items) => (items?.length ? `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : "<p class='muted'>—</p>");
  let diff = "";
  if (data.alignment) {
    const words = data.alignment.words
      .map((w) => (w.status === "matched" ? escapeHtml(w.word) : `<span class="omitted">${escapeHtml(w.word)}</span>`))
      .join(" ");
    const extra = data.alignment.inserted.length
      ? `<p class="small">Extra words: ${data.alignment.inserted.map((w) => `<span class="inserted">${escapeHtml(w)}</span>`).join(" ")}</p>`
      : "";
    diff = `<div class="result-section"><h3>Word check (${data.alignment.matched}/${data.alignment.total} words)</h3>
      <p class="legend"><span class="diff"><span class="omitted">struck</span></span> = missed or not recognised</p>
      <div class="diff">${words}</div>${extra}</div>`;
  }
  const tips = f.pronunciationTips?.length
    ? `<div class="result-section"><h3>Pronunciation tips</h3><ul>${f.pronunciationTips
        .map((t) => `<li><b>${escapeHtml(t.word)}</b> — ${escapeHtml(t.tip)}</li>`)
        .join("")}</ul></div>`
    : "";
  const answerTitle = q.task === "read-aloud" || q.task === "repeat-sentence" ? "How to deliver it" : "Model answer";

  $("result").innerHTML = `
    <div class="score-head">
      <div class="overall"><div class="num lvl-${level((data.overall - 10) / 80)}">${data.overall}</div><div class="lbl">Estimated score (10–90)</div></div>
      <div class="traits">${traitHtml}</div>
    </div>
    <div class="metrics">${metrics}</div>
    <p>${escapeHtml(f.summary)}</p>
    <div class="result-section"><h3>What went well</h3>${list(f.strengths)}</div>
    <div class="result-section"><h3>What to improve</h3>${list(f.improvements)}</div>
    ${tips}
    ${diff}
    <div class="result-section"><h3>${answerTitle}</h3><div class="model-answer">${escapeHtml(f.modelAnswer)}</div></div>
    ${q.task !== "read-aloud" && q.task !== "describe-image" ? `<div class="result-section"><h3>Original audio text</h3><div class="model-answer">${escapeHtml(q.text)}</div></div>` : ""}
    <p class="disclaimer">This is a practice estimate, not an official PTE score. Fluency and pronunciation are judged from the
      speech recogniser's transcript, confidence and timing rather than the raw audio, so treat them as a guide.</p>
    <div class="controls"><button type="button" class="primary" id="next-after">Next question ›</button></div>`;
  $("next-after").onclick = () => {
    showQuestion(currentIndex + 1);
    $("question").scrollIntoView({ behavior: "smooth" });
  };
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(q, data) {
  const history = [{ task: TASKS[q.task].name, overall: data.overall, at: Date.now() }, ...loadHistory()].slice(0, 20);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
  renderHistory();
}

function renderHistory() {
  const history = loadHistory();
  $("history").innerHTML = history.length
    ? history.slice(0, 8).map((h) => `<li><b>${h.overall}</b> · ${escapeHtml(h.task)}</li>`).join("")
    : `<li class="muted" style="list-style:none;margin-left:-20px">No attempts yet</li>`;
}

function renderChart(q) {
  const W = 560;
  const H = 340;
  const title = `<text class="title" x="${W / 2}" y="24" text-anchor="middle">${escapeHtml(q.title)}</text>`;
  if (q.image === "pie") {
    const colors = ["#1f6feb", "#2da44e", "#bf8700", "#cf222e", "#8250df"];
    const total = q.data.reduce((a, [, v]) => a + v, 0);
    let angle = -Math.PI / 2;
    const cx = 190, cy = 190, r = 130;
    const slices = q.data.map(([label, v], i) => {
      const a2 = angle + (v / total) * Math.PI * 2;
      const large = a2 - angle > Math.PI ? 1 : 0;
      const p = (a) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      const path = `<path d="M${cx},${cy} L${p(angle)} A${r},${r} 0 ${large} 1 ${p(a2)} Z" fill="${colors[i]}" stroke="var(--surface)" stroke-width="2"/>`;
      const legend = `<rect x="360" y="${90 + i * 30}" width="14" height="14" rx="3" fill="${colors[i]}"/>
        <text x="382" y="${102 + i * 30}">${escapeHtml(label)} — ${v}%</text>`;
      angle = a2;
      return path + legend;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(q.title)}">${title}${slices.join("")}</svg>`;
  }

  const left = 50, right = 20, top = 44, bottom = 40;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const maxV = Math.max(...q.data.map(([, v]) => v));
  const niceMax = Math.ceil(maxV / Math.pow(10, Math.floor(Math.log10(maxV)))) * Math.pow(10, Math.floor(Math.log10(maxV)));
  const y = (v) => top + plotH - (v / niceMax) * plotH;
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => `<line x1="${left}" x2="${W - right}" y1="${y(niceMax * f)}" y2="${y(niceMax * f)}" stroke="var(--chart-grid)"/>
      <text x="${left - 8}" y="${y(niceMax * f) + 4}" text-anchor="end">${Math.round(niceMax * f)}</text>`)
    .join("");
  const step = plotW / q.data.length;
  const xLabels = q.data
    .map(([label], i) => `<text x="${left + step * (i + 0.5)}" y="${H - bottom + 20}" text-anchor="middle">${escapeHtml(label)}</text>`)
    .join("");

  let marks;
  if (q.image === "bar") {
    marks = q.data
      .map(([, v], i) => `<rect x="${left + step * i + step * 0.2}" y="${y(v)}" width="${step * 0.6}" height="${top + plotH - y(v)}" rx="3" fill="var(--chart-1)"/>
        <text x="${left + step * (i + 0.5)}" y="${y(v) - 6}" text-anchor="middle">${v}</text>`)
      .join("");
  } else {
    const pts = q.data.map(([, v], i) => [left + step * (i + 0.5), y(v)]);
    marks = `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="var(--chart-1)" stroke-width="3"/>` +
      pts.map(([px, py], i) => `<circle cx="${px}" cy="${py}" r="4.5" fill="var(--chart-1)"/>
        <text x="${px}" y="${py - 10}" text-anchor="middle">${q.data[i][1]}</text>`).join("");
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(q.title)}">${title}${grid}${marks}${xLabels}</svg>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function round(x) {
  return Math.round(x * 100) / 100;
}
