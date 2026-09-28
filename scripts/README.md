# Pepperstone CSV converter

`convert_pepperstone.py` converts Pepperstone order-history exports into the CSV shape accepted by the Trading Journal importer.

## Usage

Convert both files in `trades_hoje`:

```bash
python3 scripts/convert_pepperstone.py \
  trades_hoje/pepperstone-historico-de-ordens-todos-2026-09-17T20_02_22.241Z_114bc.csv \
  trades_hoje/pepperstone-historico-de-ordens-todos-2026-09-23T22_41_46.344Z_38990.csv \
  --output trades_hoje/pepperstone-trades-import.csv \
  --report trades_hoje/pepperstone-conversion-report.json
```

Or pass a directory:

```bash
python3 scripts/convert_pepperstone.py trades_hoje \
  --output trades_hoje/pepperstone-trades-import.csv \
  --report trades_hoje/pepperstone-conversion-report.json
```

The generated CSV can be uploaded from **Trades → Import CSV**.

## Conversion rules

- Reads UTF-8 Pepperstone exports with comma, semicolon, or tab delimiters.
- Keeps only executed, filled orders.
- Collapses duplicate base/`SL:`/`TP:` execution rows and exact duplicate rows.
- Treats `Mercado` orders as entries and matches opposite-side exits FIFO by symbol.
- Splits partial exits into separate journal trades when necessary.
- Uses absolute commission as `fees` because Pepperstone exports commission as a negative amount.
- Preserves the Pepperstone local timestamp text as a timezone-naive ISO timestamp; it does not invent a timezone conversion.
- Writes warnings for unmatched entries/exits and errors for malformed rows.
- Does not write to the database. It only creates a CSV and optional JSON report.
