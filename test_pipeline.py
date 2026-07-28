"""
Full pipeline integration test scaffold.
------------------------------------------
Reads ONE shared input.json and walks it through all 4 stages, ending at
Guardian. Right now Task 1-3's real functions are placeholders - swap each
one in as teammates finish their pieces. Nothing on the Guardian side needs
to change; it just receives whatever the earlier stages hand it.

Run:
    python test_pipeline.py
"""

import json
from granite_guardian import guardian_check_from_orchestrator, check_ollama_status, warm_up_model


def main():
    if not check_ollama_status():
        raise SystemExit(1)
    warm_up_model()

    with open("input.json") as f:
        request = json.load(f)

    user_prompt = request["user_prompt"]
    uploaded_files = request["uploaded_files"]
    print("Step 1 (Frontend/input) - user_prompt:", user_prompt)
    print("Step 1 (Frontend/input) - uploaded_files:", uploaded_files)

    # --- Step 2: Data Prep (Task 2) -----------------------------------
    # Replace this with her real function once ready, e.g.:
    #   source_text = data_prep.extract_text(uploaded_files)
    source_text = (
        "Q3 Sales Report: Total revenue was $4.2M, up 12% year over year. "
        "Total expenses were $2.8M. Net profit was $1.4M with a 33% margin."
    )  # placeholder standing in for Task 2's extracted text
    print("\nStep 2 (Data Prep) - source_text ready:", bool(source_text))

    # --- Step 3: Orchestrator (Task 3) --------------------------------
    # Replace this with her real function once ready, e.g.:
    #   orchestrator_output = orchestrator.run(user_prompt, uploaded_files, source_text)
    orchestrator_output = {
        "optimized_prompt": user_prompt,
        "selected_model": "granite4.1:8b",
        "task_style": "balanced",
        "temperature_used": 0.5,
        "generated_output": (
            "Slide 1: Revenue. Slide 2: Expenses. Slide 3: Profit."
        ),  # placeholder standing in for the real generated output
    }
    print("\nStep 3 (Orchestrator) - selected_model:", orchestrator_output["selected_model"])

    # --- Step 4: Guardian (Task 4 - you) ------------------------------
    result = guardian_check_from_orchestrator(orchestrator_output, uploaded_files, source_text)
    print("\nStep 4 (Guardian) - result:")
    print(json.dumps(result, indent=2))

    if not result["pass"]:
        print("\nGuardian flagged issues - in the real pipeline, Task 3 would now call:")
        print("  regenerate(result['retry_prompt'], result['retry_temperature'])")
        print("  then call guardian_check_from_orchestrator(...) one more time.")


if __name__ == "__main__":
    main()