# Data Schema — REC Fraud Detection System

## 1. Transaction Schema (`transactions.csv` / JSON)
Input from Role 1 (`ml/`):
- `from_party_id` (string): Originating entity ID
- `to_party_id` (string): Receiving entity ID
- `certificate_id` (string): Unique REC certificate identifier
- `transfer_timestamp` (ISO8601 UTC string): Timestamp of certificate transfer

## 2. Certificate Schema (`certificates.csv` / JSON)
Input from Role 1 (`ml/`):
- `certificate_id` (string): Unique identifier
- `plant_lat` (float): Latitude of generation plant
- `plant_lon` (float): Longitude of generation plant
- `generation_timestamp` (ISO8601 UTC string): Timestamp of energy generation
- `energy_source` (string): e.g. "solar", "wind", "hydro"
- `claimed_mwh` (float): Claimed generation in Megawatt hours
- `capacity_mwh` (float): Maximum plant capacity rating

## 3. Anomaly & Fraud Signals (Role 1 + Role 2 Output)
- `isolation_forest_flag` (bool): Role 1 statistical outlier flag
- `isolation_forest_score` (float: 0.0 - 1.0): Anomaly score from Role 1
- `graph_flag` (bool): Role 2 fraud ring / cycle / high-density cluster flag
- `graph_risk` (float: 0.0 - 1.0): Role 2 party-level rollup risk score
- `weather_mismatch` (bool): Role 2 physical plausibility check flag
- `weather_mismatch_score` (float: 0.0 - 1.0): Role 2 weather/generation mismatch gradient
- `explanation` (string | null): Role 2 Claude-generated plain-English reasoning

## 4. Ledger Record Schema (Role 3 `ledger_cloud/`)
- `index` (int): Block sequence
- `timestamp` (ISO8601 string): Block creation time
- `certificate_id` (string)
- `signals` (object): Combined signal flags and scores
- `previous_hash` (string): SHA256 of preceding block
- `hash` (string): SHA256 hash of current block
