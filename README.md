# Granite Guardian - Validation Layer (Task 4)

Guardian is the quality gate between whatever Task 3 (Payal's orchestrator) generates and what actually reaches the frontend. It runs a local Granite model via Ollama, checks the output against 9 criteria plus a temperature sanity check, and — if something's wrong — hands back a ready-to-use retry prompt instead of just saying "fail."

**No vision model.** Guardian is text-only now — it never receives image inputs, so all image judging (`granite3.2-vision`, `check_image_content`, etc.) has been removed. A `.png`/`.jpg`/etc. showing up in `generated_output.files` is now just flagged as `unsupported` (doesn't affect pass/fail) rather than validated.

---

## 1. Setup

```bash
pip install -r requirements.txt
ollama pull granite4.1:8b
ollama serve   # in a separate terminal, if not already running
```

That's the only model you need — `requirements.txt` only lists `requests`, `python-pptx`, `python-docx`, `pypdf`, and `openpyxl` (for reading generated `.pptx`/`.docx`/`.pdf`/`.xlsx` files). No image libraries.

---

## 2. The three ways to run it

### a) Against real pipeline files (the one that matters day-to-day)

```bash
python granite_guardian.py --files
python granite_guardian.py --files path/to/generated_result.json path/to/cleaned_input.json
```

Without arguments it looks for `generated_result.json` and `cleaned_input.json` in the current folder.

- **`generated_result.json`** — Payal's output: `optimized_prompt`, `selected_model`, `task_style`, `temperature_used`, `generated_output: {type, files, text}`.
- **`cleaned_input.json`** — Shalmalee's output: `original_prompt`, `document_text`, `requirements: {task, output_format, tone}`, `metadata.documents[].filename`.

Guardian extracts `document_text` (truncated to 12,000 characters if the source document is huge — a 500k-character PDF is way more than an 8B model's context window can use productively) and the list of source filenames from `cleaned_input.json`, then judges `generated_result.json`'s output against them.

### b) Full mock test suite (development/regression testing)

```bash
python granite_guardian.py
```

Runs 9 built-in test cases (one per failure mode: too few slides, missing topic, ignored file, wrong format, fabricated numbers, incoherent writing, temperature too cold/hot, etc.), plus a full generate→guardian→retry demo, plus two orchestrator-adapter shape checks. Good for confirming nothing broke after a code change.

### c) Curated demo subset

```bash
python granite_guardian.py --demo
```

Just 2 cases (one hallucination catch, one temperature catch) — for live presentations where running all 9 would take too long.

---

## 3. What `--files` mode writes

Every run of `--files` mode always writes **three files with fixed names**, overwritten each time, into `guardian_results/`:

| File | Written | Contents |
|---|---|---|
| `generated_output.json` | always | The full verdict — all 9 checks + temperature check, with pass/fail and reasons for each. For debugging. |
| `final.json` | always | `{"files": [...], "text": "..."}`. **Populated** with the real generated content if Guardian **passed**. **Empty** (`{"files": [], "text": ""}`) if it **failed** — there's nothing valid to hand the frontend yet. |
| `retry.json` | always | `{"retry_prompt", "retry_temperature", "failed_checks", "feedback"}`. **Populated** if Guardian **failed** — this is a self-contained prompt (the original `optimized_prompt` with the specific failure feedback folded in) ready to send straight back to Task 3, since Task 3 has no memory between calls. **Empty/null** if it **passed**. |

Fixed filenames on purpose — the orchestrator can always read `guardian_results/final.json` directly, no need to glob for "the latest" file.

Nothing is lost by overwriting them: **`guardian_results/run_log.jsonl`** gets one line appended every run (timestamp, pass/fail, failed checks, and the paths written), so you still have a full history to trace back through even though only the latest result lives at the three fixed paths.

---

## 4. The 9 checks (+ 1 free one)

Run against `generated_result.json`'s actual output content vs. the request and source document:

**Structural (pass/fail):**
1. `requirement_match` — did it satisfy explicit counts/instructions (e.g. "10 slides")?
2. `missing_information` — are all requested topics present at all?
3. `completeness` — did it actually use every uploaded/source file?
4. `formatting` — does it match the requested structure (slides vs. paragraph, etc.)?

**Quality (score 1-5, pass requires ≥3):**
5. `fluency` — grammatically correct, natural to read?
6. `coherence` — logical flow, no self-contradiction?
7. `relevance` — stays on-topic, no padding?
8. `factual_accuracy` — do the numbers/claims match the source document? High-severity — any invented figure fails this. Skipped automatically (`not_checked`) if no source text was provided.

**Informational only (doesn't affect pass/fail):**
9. `creativity` — how original/engaging, scored 1-5.

**Free, non-LLM check:**
- `temperature` — was the temperature Task 3 actually used appropriate for its declared `task_style`? (`creative`: 0.7–1.0, `balanced`: 0.4–0.7, `deterministic`: 0.0–0.3.) Only runs if both `task_style` and `temperature_used` are provided.

**Isolation rule:** every check except `factual_accuracy` takes stated numbers at face value — a wrong `$6.5M` figure only fails `factual_accuracy`, not `relevance` or `requirement_match`, so one bad number doesn't cascade into unrelated failures.

Also two fast, non-LLM structural checks specific to file delivery:
- `output_delivered` — fails if `generated_output.type` is `"file"` but `files` is empty.
- `file_unreadable` — fails if a listed file can't actually be opened/parsed.

---

## 5. Known gotcha worth knowing about

The real `generated_result.json` from the pipeline currently sets `generated_output.type: "file"` even when only text was produced (`files: []`). This trips `output_delivered` even though the actual text content is often fine. Worth flagging to Payal: `type` should probably be driven by `cleaned_input.json`'s `requirements.output_format` field rather than hardcoded, since that field already correctly says `"text"` for text-only requests.

---

## 6. Other scripts in this repo

| Script | Purpose | Needs Ollama? |
|---|---|---|
| `test_files.py` | Generates real `.pptx`/`.docx`/`.xlsx` + a corrupted file + an unsupported format, runs each through the full pipeline. Confirms file extraction works. | Yes (`granite4.1:8b` only) |
| `generated_result_pass.json` / `cleaned_input_pass.json` | A clean, accurate test case — should always PASS. | — |
| `generated_result_fail.json` / `cleaned_input_fail.json` | Deliberately fabricated numbers (open rate, CTR, lead count) — should FAIL `factual_accuracy` only. | — |

Run the pass/fail pair with:
```bash
python granite_guardian.py --files generated_result_pass.json cleaned_input_pass.json
python granite_guardian.py --files generated_result_fail.json cleaned_input_fail.json
```

---

## 7. Function reference (for anyone editing the code)

- `guardian_check(user_prompt, uploaded_files, ai_output, source_text, task_style, temperature_used)` — the core LLM judgment call, works on plain text.
- `guardian_check_from_orchestrator(orchestrator_output, uploaded_files, source_text)` — adapter for Task 3's raw output shape; extracts real file content when `files` is populated, falls back to `text` otherwise.
- `guardian_check_from_files(generated_result_path, cleaned_input_path)` — the real entry point: loads both JSON files, calls the above, saves results via `save_guardian_result`.
- `save_guardian_result(result, orchestrator_output)` — writes the three fixed-name files + appends to the run log.
- `extract_file_content(file_path)` — reads `.pptx`/`.docx`/`.pdf`/`.xlsx`/`.xls`/`.txt`/`.csv`/`.md`. Anything else (including images) comes back as `unsupported`, never raises.
- `build_retry_payload(user_prompt, temperature_used, guardian_result)` — constructs the retry prompt + temperature from a failed result.
- `run_with_guardian(...)` — full generate→check→retry-once loop, used by the mock test suite's demo section (not the real `--files` pipeline, which is one-shot — Task 3 owns her own retry loop using `retry.json`).