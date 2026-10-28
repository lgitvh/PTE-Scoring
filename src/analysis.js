// Deterministic checks that don't need a model: word alignment against a
// reference text, short-answer matching, and delivery metrics.

const NUMBER_WORDS = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
};

export function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => NUMBER_WORDS[w] ?? w);
}

// Word-level alignment (LCS) between the reference and what was said.
// Returns the reference words tagged as matched/omitted plus inserted words.
export function alignWords(reference, spoken) {
  const ref = tokenize(reference);
  const hyp = tokenize(spoken);
  const n = ref.length;
  const m = hyp.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = ref[i] === hyp[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const words = [];
  const inserted = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ref[i] === hyp[j]) {
      words.push({ word: ref[i], status: "matched" });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      words.push({ word: ref[i], status: "omitted" });
      i++;
    } else {
      inserted.push(hyp[j]);
      j++;
    }
  }
  while (i < n) words.push({ word: ref[i++], status: "omitted" });
  while (j < m) inserted.push(hyp[j++]);

  const matched = words.filter((w) => w.status === "matched").length;
  return {
    words,
    inserted,
    matched,
    total: n,
    accuracy: n ? matched / n : 0,
  };
}

export function matchShortAnswer(answers, spoken) {
  const said = ` ${tokenize(spoken).join(" ")} `;
  return answers.some((a) => said.includes(` ${tokenize(a).join(" ")} `));
}

// `delivery` comes from the browser: recording length, when speech started,
// and the gaps between recognised speech segments.
export function deliveryMetrics(transcript, delivery = {}) {
  const wordCount = tokenize(transcript).length;
  const speakingSec = Math.max(0, (delivery.durationSec || 0) - (delivery.onsetSec || 0));
  const pauses = (delivery.pauses || []).filter((p) => typeof p === "number" && p > 0);
  return {
    wordCount,
    durationSec: round(delivery.durationSec || 0),
    onsetSec: round(delivery.onsetSec || 0),
    wordsPerMinute: speakingSec > 0 ? Math.round((wordCount / speakingSec) * 60) : 0,
    longPauses: pauses.filter((p) => p >= 1).length,
    longestPauseSec: round(pauses.length ? Math.max(...pauses) : 0),
    asrConfidence: typeof delivery.confidence === "number" ? round(delivery.confidence) : null,
    lowConfidenceWords: (delivery.lowConfidenceWords || []).slice(0, 30),
  };
}

function round(x) {
  return Math.round(x * 100) / 100;
}
