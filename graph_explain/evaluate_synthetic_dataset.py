"""
Role 1 Synthetic Dataset Validation & Recall Benchmark (Rule 12).
Evaluates Role 2 pipeline against 1,242 real synthetic certificates & 3,735 transactions.
Reports exact recall numbers for HackOut'26 demo talking points and correctness checks.
"""

import os
import sys
import time
import pandas as pd

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from graph_explain.pipeline import analyze_dataset

def run_evaluation():
    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
    certs_file = os.path.join(data_dir, "certificates.csv")
    txns_file = os.path.join(data_dir, "transactions.csv")

    if not os.path.exists(certs_file) or not os.path.exists(txns_file):
        print(f"Dataset not found in {data_dir}. Generating fresh dataset...")
        from ml.generate_data import generate_mock_certificates, generate_mock_transactions
        certs_df = generate_mock_certificates(count=1200)
        txns_df = generate_mock_transactions(certs_df)
        os.makedirs(data_dir, exist_ok=True)
        certs_df.to_csv(certs_file, index=False)
        txns_df.to_csv(txns_file, index=False)
    else:
        certs_df = pd.read_csv(certs_file)
        txns_df = pd.read_csv(txns_file)

    print(f"Loaded {len(certs_df)} certificates and {len(txns_df)} transactions.")

    # Convert to dictionaries for pipeline input
    certificates = certs_df.to_dict(orient="records")
    transactions = txns_df.to_dict(orient="records")

    t0 = time.time()
    results = analyze_dataset(transactions, certificates, explain_all=False)
    elapsed = round(time.time() - t0, 2)
    print(f"Pipeline executed across {len(results)} certificates in {elapsed}s.")

    res_df = pd.DataFrame(results)
    merged = pd.merge(certs_df, res_df, on="certificate_id")

    # Evaluate by Seeded Fraud Type
    print("\n" + "="*50)
    print("ROLE 2 FRAUD DETECTION BENCHMARK REPORT")
    print("="*50)

    # 1. Circular Trading Recall (Graph Cycle Detection)
    circ_mask = merged["fraud_type"] == "circular_trading"
    circ_total = circ_mask.sum()
    circ_caught = (circ_mask & (merged["graph_flag"] == True)).sum()
    circ_recall = (circ_caught / circ_total * 100) if circ_total > 0 else 0
    print(f"1. Circular Trading Recall: {circ_caught} / {circ_total} ({circ_recall:.1f}%)")

    # 2. Impossible Timing (Night Solar Generation)
    time_mask = merged["fraud_type"] == "impossible_timing"
    time_total = time_mask.sum()
    time_caught = (time_mask & (merged["weather_mismatch"] == True)).sum()
    time_recall = (time_caught / time_total * 100) if time_total > 0 else 0
    print(f"2. Impossible Timing Recall: {time_caught} / {time_total} ({time_recall:.1f}%)")

    # 3. Over-Capacity Fraud (Obvious, Subtle, & Round-Number Padding)
    cap_mask = merged["fraud_type"] == "over_capacity"
    cap_total = cap_mask.sum()
    cap_caught = (cap_mask & (merged["weather_mismatch"] == True)).sum()
    cap_recall = (cap_caught / cap_total * 100) if cap_total > 0 else 0
    print(f"3. Over-Capacity Recall: {cap_caught} / {cap_total} ({cap_recall:.1f}%)")

    # Combined Role 2 Direct Scope (Circular + Impossible Timing + Over Capacity)
    role2_scope_mask = circ_mask | time_mask | cap_mask
    role2_total = role2_scope_mask.sum()
    role2_flagged = (role2_scope_mask & ((merged["graph_flag"] == True) | (merged["weather_mismatch"] == True))).sum()
    role2_recall = (role2_flagged / role2_total * 100) if role2_total > 0 else 0
    print(f"\n>> Total Role 2 Scope Recall: {role2_flagged} / {role2_total} ({role2_recall:.1f}%) <<")

    # Clean Certificates Specificity / False Positive Rate
    clean_mask = merged["is_fraud"] == False
    clean_total = clean_mask.sum()
    clean_flagged = (clean_mask & ((merged["graph_flag"] == True) | (merged["weather_mismatch"] == True))).sum()
    clean_specificity = ((clean_total - clean_flagged) / clean_total * 100) if clean_total > 0 else 0
    print(f"Clean Certificates Specificity: {(clean_total - clean_flagged)} / {clean_total} ({clean_specificity:.1f}%)")
    print(f"False Positive Rate on Clean: {clean_flagged} / {clean_total} ({clean_flagged/clean_total*100:.1f}%)")

    # Sample Explanations Demo
    print("\n" + "="*50)
    print("SAMPLE EXPLAINABILITY OUTPUTS (Claude Layer)")
    print("="*50)
    for ft in ["circular_trading", "impossible_timing", "over_capacity"]:
        sample = merged[merged["fraud_type"] == ft].iloc[0]
        print(f"\n[Fraud Type: {ft.upper()}] Certificate {sample['certificate_id']}")
        print(f"Graph Risk: {sample['graph_risk']} | Weather Mismatch: {sample['weather_mismatch']}")
        print(f"Explanation: {sample['explanation']}")

    print("\n" + "="*50)
    print("BENCHMARK COMPLETE")
    print("="*50)

if __name__ == "__main__":
    run_evaluation()
