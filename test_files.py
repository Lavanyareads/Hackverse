"""
Test the Guardian pipeline against a REAL uploaded PDF.
------------------------------------------------------------------
Uses Discrete_Mathematics.pdf as the ground-truth SOURCE_TEXT, and runs
three realistic AI-output scenarios against it through
guardian_check_from_orchestrator() - no vision model involved.

Only requires:
    ollama pull granite4.1:8b

Before running: put Discrete_Mathematics.pdf in the same folder as this
script (or edit PDF_PATH below to point at it).

Run:
    python test_real_pdf.py
"""

import json
import os

from granite_guardian import (
    check_ollama_status,
    warm_up_model,
    guardian_check_from_orchestrator,
    extract_file_content,
)

PDF_PATH = r"C:\Users\meghn\Desktop\coding\hackverse\Discrete Mathematics.pdf"  # <- edit if your file lives elsewhere


if __name__ == "__main__":
    if not os.path.exists(PDF_PATH):
        print("Could not find '" + PDF_PATH + "'. Edit PDF_PATH at the top of this script.")
        raise SystemExit(1)

    if not check_ollama_status():
        print("\nFix the issue above, then rerun this script.")
        raise SystemExit(1)

    warm_up_model()

    # --- Step 1: extract the real source text from the real PDF -----------
    extraction = extract_file_content(PDF_PATH)
    if extraction["kind"] != "text":
        print("Extraction failed:", extraction["error"])
        raise SystemExit(1)

    source_text = extraction["content"]
    print("Extracted", len(source_text), "characters from", PDF_PATH, "\n")

    # --- Step 2: three realistic AI-output scenarios to judge -------------

    accurate_summary = (
        "Here is a summary of the Discrete Mathematics guide.\n\n"
        "Set Theory: the union of A={1,2,3} and B={3,4,5} is {1,2,3,4,5}, and their "
        "intersection is {3}. The power set of a set with n elements has 2^n subsets.\n\n"
        "Trees: a binary search tree keeps left-subtree keys smaller than the root and "
        "right-subtree keys larger, and an inorder traversal of a BST always yields a "
        "sorted sequence. A spanning tree of a connected graph with n vertices always has "
        "exactly n-1 edges.\n\n"
        "Graph Theory: a complete graph K_n has n(n-1)/2 edges. An Euler circuit exists iff "
        "the graph is connected and every vertex has even degree.\n\n"
        "Algebraic Structures: the hierarchy runs Groupoid, Semigroup, Monoid, Group, "
        "Abelian Group, with each level adding one more property (associativity, identity, "
        "inverse, commutativity respectively). A field is a commutative ring with unity "
        "where every nonzero element has a multiplicative inverse."
    )

    fabricated_summary = (
        "Here is a summary of the Discrete Mathematics guide.\n\n"
        "Set Theory: the power set of a set with n elements has 3^n subsets, not 2^n.\n\n"
        "Trees: a spanning tree of a connected graph with n vertices has exactly n edges.\n\n"
        "Graph Theory: a complete graph K_n has n^2 edges. An Euler circuit exists whenever "
        "a graph has at least one vertex of odd degree.\n\n"
        "Algebraic Structures: a field is any ring where addition is commutative, regardless "
        "of whether multiplicative inverses exist."
    )

    TEST_CASES = [
        {
            "name": "Accurate summary of the real PDF - should PASS",
            "orchestrator_output": {
                "optimized_prompt": "Summarize the key definitions and formulas from the discrete mathematics study guide.",
                "task_style": "balanced",
                "temperature_used": 0.5,
                "generated_output": {"type": "text", "files": [], "text": accurate_summary},
            },
        },
        {
            "name": "Fabricated formulas/facts - should FAIL (factual_accuracy) ONLY",
            "orchestrator_output": {
                "optimized_prompt": "Summarize the key definitions and formulas from the discrete mathematics study guide.",
                "task_style": "balanced",
                "temperature_used": 0.5,
                "generated_output": {"type": "text", "files": [], "text": fabricated_summary},
            },
        },
        {
            "name": "Whole PDF handed back as-is instead of a slide deck - should FAIL (formatting)",
            "orchestrator_output": {
                "optimized_prompt": "Turn this study guide into a 10-slide presentation, one topic per slide.",
                "task_style": "balanced",
                "temperature_used": 0.5,
                "generated_output": {"type": "file", "files": [PDF_PATH], "text": ""},
            },
        },
    ]

    for case in TEST_CASES:
        print("\n=== " + case["name"] + " ===")
        result = guardian_check_from_orchestrator(
            case["orchestrator_output"],
            uploaded_files=["Discrete_Mathematics.pdf"],
            source_text=source_text,
        )
        print(json.dumps(result, indent=2))