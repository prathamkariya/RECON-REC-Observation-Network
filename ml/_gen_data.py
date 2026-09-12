"""One-time script to generate data/certificates.csv and data/transactions.csv"""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'data'), exist_ok=True)

from ml.generate_data import generate_mock_certificates, generate_mock_transactions
import statistics

print('Generating certificates (n=1200)...')
certs_df = generate_mock_certificates(count=1200)
print(f'Generated {len(certs_df)} certificates')

print('Generating transactions...')
txns_df = generate_mock_transactions(certs_df)
print(f'Generated {len(txns_df)} transactions')

data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
certs_df.to_csv(os.path.join(data_dir, 'certificates.csv'), index=False)
txns_df.to_csv(os.path.join(data_dir, 'transactions.csv'), index=False)
print('Saved to data/')

print('\n=== Fraud breakdown ===')
print(certs_df['fraud_type'].value_counts(dropna=False).to_string())

print('\n=== Party involvement stats ===')
party_counts = {}
for _, row in txns_df.iterrows():
    party_counts[row['from_party_id']] = party_counts.get(row['from_party_id'], 0) + 1
    party_counts[row['to_party_id']] = party_counts.get(row['to_party_id'], 0) + 1

vals = list(party_counts.values())
print(f'  Unique parties: {len(party_counts)}')
print(f'  Total transactions: {len(txns_df)}')
print(f'  Min: {min(vals)}, Max: {max(vals)}, Median: {statistics.median(vals):.1f}')
circular = (certs_df['fraud_type'] == 'circular_trading').sum()
print(f'  circular_trading certs: {circular}')
