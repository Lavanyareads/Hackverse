# Granite Guardian (Task 4 - Validation Layer)

Checks generated output against the original request before it reaches the
user: right slide/word counts, all requested topics covered, every uploaded
file actually used, correct format, fluent/coherent/relevant writing, no
fabricated numbers, and (if given) an appropriate generation temperature.
If something fails, it returns a ready-to-use retry prompt so the calling
code can regenerate once and re-check.

## Setup (required on whichever laptop runs the full pipeline)

1. Install [Ollama](https://ollama.com)
2. Pull the model:
   ```bash
   ollama pull granite4.1:8b
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

**This has to be done on whichever machine actually runs the integrated
pipeline** - Guardian talks to Ollama on `localhost`, so if it can't find
Ollama + the model locally, it fails gracefully (returns a clear error, not
a crash) but won't actually validate anything.

## Quick check everything's working

```bash
python granite_guardian.py --demo
```

## How to call it from the integrated pipeline

```python
from granite_guardian import guardian_check_from_orchestrator

result = guardian_check_from_orchestrator(
    orchestrator_output,   # Task 3's dict: optimized_prompt, generated_output,
                            # task_style, temperature_used, selected_model
    uploaded_files,        # list of filenames from Task 1, e.g. ["Q3_Report.pdf"]
    source_text,           # extracted text from Task 2 (optional but recommended -
                            # enables the factual-accuracy check)
)

if not result["pass"]:
    print(result["feedback"])          # what's wrong, human-readable
    # regenerate using:
    #   result["retry_prompt"]
    #   result["retry_temperature"]
    # then call guardian_check_from_orchestrator(...) once more with the new output
```

See `test_pipeline.py` for a full worked example chaining all 4 stages
together, with placeholders marked for each teammate's real function.

## Files in this repo

| File | Purpose |
|---|---|
| `granite_guardian.py` | Core validation logic - the only file others need to import |
| `test_pipeline.py` | End-to-end integration test scaffold |
| `input.json` | Sample shared request used by `test_pipeline.py` |
| `requirements.txt` | Python dependencies |