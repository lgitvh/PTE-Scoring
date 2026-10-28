import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { QUESTIONS, TASKS, getQuestion } from "./questions.js";
import { scoreResponse, ScoringError } from "./scorer.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(here, "..", "public")));

app.get("/api/tasks", (_req, res) => {
  const questions = QUESTIONS.map(({ answers, keyPoints, ...q }) => q);
  res.json({ tasks: TASKS, questions });
});

app.post("/api/score", async (req, res) => {
  const { questionId, transcript, delivery } = req.body ?? {};
  const question = getQuestion(questionId);
  if (!question) return res.status(400).json({ error: "Unknown question." });
  if (typeof transcript !== "string" || transcript.length > 5000) {
    return res.status(400).json({ error: "Transcript must be a string under 5000 characters." });
  }

  try {
    res.json(await scoreResponse(question, transcript, delivery ?? {}));
  } catch (err) {
    if (err instanceof ScoringError) return res.status(502).json({ error: err.message });
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "The server's Anthropic API key is missing or invalid." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Too many scoring requests right now. Wait a moment and try again." });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      return res.status(502).json({ error: "The scoring service is unavailable. Please try again." });
    }
    console.error(err);
    res.status(500).json({ error: "Unexpected server error." });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`PTE practice running at http://localhost:${port}`));
