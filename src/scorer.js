import Anthropic from "@anthropic-ai/sdk";
import { TASKS } from "./questions.js";
import { alignWords, deliveryMetrics, matchShortAnswer } from "./analysis.js";

const MODEL = process.env.PTE_MODEL || "claude-opus-5-5";

const client = new Anthropic();

// Maximum points per trait, following the PTE Academic speaking rubrics.
// A null max means the trait isn't scored for that task.
const TRAIT_MAX = {
  "read-aloud": { content: 5, oralFluency: 5, pronunciation: 5 },
  "repeat-sentence": { content: 3, oralFluency: 5, pronunciation: 5 },
  "describe-image": { content: 5, oralFluency: 5, pronunciation: 5 },
  "retell-lecture": { content: 5, oralFluency: 5, pronunciation: 5 },
  "answer-short-question": { content: 1, oralFluency: null, pronunciation: null },
};

const SYSTEM = `You are an experienced PTE Academic speaking examiner. You score a candidate's spoken response using the official PTE Academic rubrics and give practical coaching feedback.

You cannot hear the audio. You receive:
- the task and its prompt (reference text, lecture transcript or a description of the image),
- the speech-recognition transcript of the candidate's answer,
- delivery evidence measured in the browser: recording length, time before the candidate started speaking, words per minute, number and length of pauses, speech-recogniser confidence, and words the recogniser was unsure about,
- for Read Aloud and Repeat Sentence, a word-by-word alignment against the reference.

Infer fluency and pronunciation from that evidence. Low recogniser confidence, misrecognised words that sound like the intended ones, and recogniser substitutions usually indicate pronunciation problems. Long pauses, restarts, repetitions, filler words, very slow (under ~100 wpm) or rushed delivery, and a late start indicate fluency problems. Natural pace is roughly 120-160 words per minute.

Rubrics:
Oral fluency (0-5): 5 native-like, smooth rhythm and phrasing, no hesitations/repetitions/false starts; 4 advanced, acceptable rhythm, no more than one hesitation or repetition; 3 good, at most two hesitations, few false starts, no long pauses; 2 intermediate, uneven or staccato speech, several hesitations; 1 limited, slow and laboured, many long pauses; 0 disfluent, frequent long pauses or mostly unintelligible.
Pronunciation (0-5): 5 native-like, all sounds and stress correct; 4 advanced, occasional non-native sound but always easy to understand; 3 good, some consistent errors, a few words unclear; 2 intermediate, some sounds consistently mispronounced, about a third of words could be unclear; 1 intrusive, many words distorted; 0 non-English sounding.
Content for Describe Image (0-5): 5 describes all elements of the image, their relationships, possible development and a conclusion; 4 all key elements with their relationships and development; 3 the main elements and some relationships; 2 basic elements only, little relationship; 1 disjointed elements; 0 nothing relevant.
Content for Re-tell Lecture (0-5): 5 re-tells all main points and important details, relationships between them and the conclusion, accurately; 4 all main points and some details; 3 most main points, some relationships, minor inaccuracies; 2 some main points with errors or omissions; 1 isolated points, mostly irrelevant; 0 nothing relevant.

Feedback rules: be specific and encouraging; quote the candidate's own words when pointing out an issue; give pronunciation tips as simple sound-it-out guidance (e.g. "ar-KEE-oh-lo-jists"); keep each list item to one sentence. The model answer must be a strong, natural response a high scorer would give for this exact prompt (for Read Aloud and Repeat Sentence, give delivery tips instead: where to pause and which words to stress).`;

const FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    content: { type: "integer", description: "Content score; only used for Describe Image and Re-tell Lecture." },
    oralFluency: { type: "integer" },
    pronunciation: { type: "integer" },
    summary: { type: "string", description: "Two or three sentences on overall performance." },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    pronunciationTips: {
      type: "array",
      items: {
        type: "object",
        properties: { word: { type: "string" }, tip: { type: "string" } },
        required: ["word", "tip"],
        additionalProperties: false,
      },
    },
    modelAnswer: { type: "string" },
  },
  required: ["content", "oralFluency", "pronunciation", "summary", "strengths", "improvements", "pronunciationTips", "modelAnswer"],
  additionalProperties: false,
};

export class ScoringError extends Error {}

export async function scoreResponse(question, transcript, delivery) {
  const task = TASKS[question.task];
  const max = TRAIT_MAX[question.task];
  const metrics = deliveryMetrics(transcript, delivery);

  // Content that can be measured exactly is computed here, not by the model.
  let alignment = null;
  let content = null;
  if (question.task === "read-aloud") {
    alignment = alignWords(question.text, transcript);
    content = Math.round(alignment.accuracy * 5);
  } else if (question.task === "repeat-sentence") {
    alignment = alignWords(question.text, transcript);
    content = alignment.matched === alignment.total ? 3 : alignment.accuracy >= 0.5 ? 2 : alignment.matched > 0 ? 1 : 0;
  } else if (question.task === "answer-short-question") {
    content = matchShortAnswer(question.answers, transcript) ? 1 : 0;
  }

  const feedback = await askClaude(question, task, transcript, metrics, alignment);

  const traits = {
    content: clamp(content ?? feedback.content, max.content),
    oralFluency: max.oralFluency === null ? null : clamp(feedback.oralFluency, max.oralFluency),
    pronunciation: max.pronunciation === null ? null : clamp(feedback.pronunciation, max.pronunciation),
  };
  // A response with no relevant content earns nothing for delivery in PTE.
  if (traits.content === 0 && max.oralFluency !== null) {
    traits.oralFluency = 0;
    traits.pronunciation = 0;
  }

  return {
    task: question.task,
    traits,
    max,
    overall: overallScore(traits, max),
    metrics,
    alignment,
    feedback: {
      summary: feedback.summary,
      strengths: feedback.strengths,
      improvements: feedback.improvements,
      pronunciationTips: feedback.pronunciationTips,
      modelAnswer: feedback.modelAnswer,
    },
  };
}

async function askClaude(question, task, transcript, metrics, alignment) {
  const lines = [`Task: ${task.name}`, `Task instructions: ${task.instructions}`];
  if (question.task === "describe-image") {
    lines.push(`Image (described for you): ${question.keyPoints}`);
  } else if (question.task === "answer-short-question") {
    lines.push(`Question: ${question.text}`, `Accepted answers: ${question.answers.join(", ")}`);
  } else {
    lines.push(`${question.task === "retell-lecture" ? "Lecture transcript" : "Reference text"}: ${question.text}`);
  }
  lines.push(
    "",
    `Candidate transcript (speech recognition): ${transcript.trim() ? JSON.stringify(transcript.trim()) : "(no speech detected)"}`,
    "",
    "Delivery evidence:",
    JSON.stringify(metrics, null, 2),
  );
  if (alignment) {
    const omitted = alignment.words.filter((w) => w.status === "omitted").map((w) => w.word);
    lines.push(
      "",
      `Word alignment: ${alignment.matched}/${alignment.total} reference words matched.`,
      `Omitted or misrecognised reference words: ${omitted.join(", ") || "none"}`,
      `Extra words spoken: ${alignment.inserted.join(", ") || "none"}`,
    );
  }
  if (question.task === "read-aloud" || question.task === "repeat-sentence" || question.task === "answer-short-question") {
    lines.push("", "Content for this task is scored automatically; return 0 for the content field.");
  }
  if (question.task === "answer-short-question") {
    lines.push("Fluency and pronunciation are not scored for this task; return 0 for both and focus feedback on the answer and vocabulary.");
  }

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: FEEDBACK_SCHEMA },
    },
    system: SYSTEM,
    messages: [{ role: "user", content: lines.join("\n") }],
  });

  if (response.stop_reason === "refusal") {
    throw new ScoringError("The scoring model declined this response. Please try again.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new ScoringError("The scoring response was cut off. Please try again.");
  }
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return JSON.parse(text);
  } catch {
    throw new ScoringError("Could not read the scoring result. Please try again.");
  }
}

// Map trait points onto the 10-90 PTE scale with equal weight per scored trait.
export function overallScore(traits, max) {
  let earned = 0;
  let possible = 0;
  for (const key of Object.keys(max)) {
    if (max[key] === null) continue;
    earned += (traits[key] ?? 0) / max[key];
    possible += 1;
  }
  return Math.round(10 + 80 * (possible ? earned / possible : 0));
}

function clamp(value, max) {
  const n = Number.isFinite(value) ? Math.round(value) : 0;
  return Math.min(max, Math.max(0, n));
}
