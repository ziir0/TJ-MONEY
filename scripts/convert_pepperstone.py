#!/usr/bin/env python3
"""Convert Pepperstone order-history CSV exports into Trading Journal trades.

The converter intentionally works only with completed orders. It ignores cancelled
protective orders, collapses Pepperstone's primary/SL/TP duplicate representations,
and matches market entries to executed exits FIFO by symbol and quantity.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict, deque
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Iterable

OUTPUT_FIELDS = [
    "symbol",
    "direction",
    "entry_price",
    "exit_price",
    "quantity",
    "fees",
    "pnl",
    "trade_date",
    "exit_date",
    "notes",
]

HEADER_ALIASES = {
    "symbol": ("Símbolo", "Simbolo", "Symbol"),
    "side": ("Lado", "Side"),
    "type": ("Tipo", "Type"),
    "quantity": ("Qtde", "Quantity", "Qty"),
    "filled_quantity": ("Qtd. Preenchida", "Filled Quantity", "Filled Qty"),
    "limit_price": ("Preço limite", "Preco limite", "Limit Price"),
    "stop_price": ("Preço de Stop", "Preco de Stop", "Stop Price"),
    "fill_price": ("Preço Méd de Preenchimento", "Preco Med de Preenchimento", "Average Fill Price", "Fill Price"),
    "status": ("Status", "Status"),
    "updated_at": ("Tempo de atualização", "Tempo de atualizacao", "Updated At", "Update Time"),
    "profit": ("Profit", "P&L", "P/L"),
    "commission": ("Commission", "Comissão", "Comissao"),
    "order_id": ("ID da ordem", "ID da ordem", "Order ID"),
}


@dataclass
class Order:
    row_number: int
    symbol: str
    side: str
    order_type: str
    quantity: float
    filled_quantity: float
    fill_price: float
    status: str
    updated_at: datetime
    profit: float
    commission: float
    order_id: str


@dataclass
class OpenLot:
    symbol: str
    side: str
    quantity: float
    entry_price: float
    entry_time: datetime
    entry_commission: float
    source_row: int


def get_value(row: dict[str, str], key: str) -> str:
    for header in HEADER_ALIASES[key]:
        if header in row and row[header] is not None:
            value = row[header].strip()
            if value:
                return value
    return ""


def parse_number(value: str, *, field: str, row_number: int, allow_blank: bool = True) -> float:
    value = (value or "").strip()
    if not value:
        if allow_blank:
            return 0.0
        raise ValueError(f"row {row_number}: {field} is required")
    # Pepperstone exports decimal points; accepting decimal commas makes the script
    # tolerant of localized re-saves in spreadsheet software.
    normalized = value.replace(" ", "").replace(",", ".")
    try:
        return float(normalized)
    except ValueError as exc:
        raise ValueError(f"row {row_number}: {field} is not numeric: {value!r}") from exc


def parse_datetime(value: str, *, row_number: int) -> datetime:
    for pattern in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(value.strip(), pattern)
        except ValueError:
            pass
    raise ValueError(f"row {row_number}: invalid update time: {value!r}")


def read_orders(path: Path) -> tuple[list[Order], list[str]]:
    errors: list[str] = []
    orders: list[Order] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        reader = csv.DictReader(handle, dialect=dialect)
        if not reader.fieldnames:
            raise ValueError(f"{path}: CSV has no header row")
        missing = [key for key in ("symbol", "side", "type", "quantity", "filled_quantity", "fill_price", "status", "updated_at") if not any(alias in reader.fieldnames for alias in HEADER_ALIASES[key])]
        if missing:
            raise ValueError(f"{path}: missing required columns for {', '.join(missing)}")

        for row_number, row in enumerate(reader, 2):
            try:
                status = get_value(row, "status").casefold()
                quantity = parse_number(get_value(row, "quantity"), field="quantity", row_number=row_number, allow_blank=False)
                filled = parse_number(get_value(row, "filled_quantity"), field="filled quantity", row_number=row_number)
                fill_price = parse_number(get_value(row, "fill_price"), field="fill price", row_number=row_number, allow_blank=False)
                orders.append(Order(
                    row_number=row_number,
                    symbol=get_value(row, "symbol").upper(),
                    side=get_value(row, "side"),
                    order_type=get_value(row, "type"),
                    quantity=quantity,
                    filled_quantity=filled,
                    fill_price=fill_price,
                    status=status,
                    updated_at=parse_datetime(get_value(row, "updated_at"), row_number=row_number),
                    profit=parse_number(get_value(row, "profit"), field="profit", row_number=row_number),
                    commission=parse_number(get_value(row, "commission"), field="commission", row_number=row_number),
                    order_id=get_value(row, "order_id"),
                ))
            except ValueError as exc:
                errors.append(str(exc))
    return orders, errors


def dedupe_orders(orders: Iterable[Order]) -> tuple[list[Order], int]:
    """Collapse duplicate execution records emitted as base + SL/TP rows.

    If an order ID exists, a protective ID such as SL:123 is considered the same
    execution as the base 123. For older exports without IDs, identical rows are
    collapsed once. Distinct rows at the same timestamp remain distinct.
    """
    result: list[Order] = []
    seen_keys: set[tuple] = set()
    for order in orders:
        raw_id = order.order_id
        canonical_id = raw_id.split(":", 1)[1] if ":" in raw_id else raw_id
        key = (
            order.symbol,
            order.side.casefold(),
            order.order_type.casefold(),
            order.quantity,
            order.filled_quantity,
            order.fill_price,
            order.status,
            order.updated_at,
            order.profit,
            order.commission,
            canonical_id,
        )
        if key in seen_keys:
            continue
        seen_keys.add(key)
        result.append(order)
    return result, sum(1 for _ in orders) - len(result)


def is_executed(order: Order) -> bool:
    return order.status in {"executado", "executed", "filled", "complete", "completed"}


def is_market(order: Order) -> bool:
    return order.order_type.casefold() in {"mercado", "market"}


def side_is_buy(side: str) -> bool:
    return side.casefold() in {"comprar", "buy", "long"}


def make_trade(entry: OpenLot, exit_order: Order, quantity: float) -> dict[str, str]:
    fraction = quantity / exit_order.filled_quantity if exit_order.filled_quantity else 1.0
    fees = abs(entry.entry_commission) * (quantity / entry.quantity) + abs(exit_order.commission) * fraction
    pnl = exit_order.profit * fraction
    direction = "long" if side_is_buy(entry.side) else "short"
    notes = f"Imported from Pepperstone order history; entry row {entry.source_row}, exit row {exit_order.row_number}"
    return {
        "symbol": entry.symbol,
        "direction": direction,
        "entry_price": format_number(entry.entry_price),
        "exit_price": format_number(exit_order.fill_price),
        "quantity": format_number(quantity),
        "fees": format_number(fees),
        "pnl": format_number(pnl),
        "trade_date": entry.entry_time.isoformat(timespec="seconds"),
        "exit_date": exit_order.updated_at.isoformat(timespec="seconds"),
        "notes": notes,
    }


def format_number(value: float) -> str:
    return f"{value:.12f}".rstrip("0").rstrip(".") or "0"


def convert_paths(paths: Iterable[Path]) -> tuple[list[dict[str, str]], dict]:
    trades: list[dict[str, str]] = []
    report = {"files": [], "errors": [], "warnings": [], "imported_trades": 0}

    for path in paths:
        raw_orders, errors = read_orders(path)
        report["errors"].extend(f"{path.name}: {error}" for error in errors)
        cleaned, duplicate_count = dedupe_orders(raw_orders)
        executed = [order for order in cleaned if is_executed(order) and order.filled_quantity > 0]
        queues: dict[str, deque[OpenLot]] = defaultdict(deque)
        file_trades: list[dict[str, str]] = []
        unmatched_exits: list[int] = []

        for order in sorted(executed, key=lambda item: item.updated_at):
            if is_market(order):
                queues[order.symbol].append(OpenLot(
                    symbol=order.symbol,
                    side=order.side,
                    quantity=order.filled_quantity,
                    entry_price=order.fill_price,
                    entry_time=order.updated_at,
                    entry_commission=order.commission,
                    source_row=order.row_number,
                ))
                continue

            remaining = order.filled_quantity
            opposite_entries = queues[order.symbol]
            while remaining > 1e-12 and opposite_entries:
                entry = opposite_entries[0]
                if side_is_buy(entry.side) == side_is_buy(order.side):
                    # Same-side protective/order records are not a close for this lot.
                    break
                matched = min(entry.quantity, remaining)
                file_trades.append(make_trade(entry, order, matched))
                entry.quantity -= matched
                remaining -= matched
                if entry.quantity <= 1e-12:
                    opposite_entries.popleft()
            if remaining > 1e-12:
                unmatched_exits.append(order.row_number)

        unmatched_entries = [lot.source_row for lots in queues.values() for lot in lots if lot.quantity > 1e-12]
        if unmatched_entries:
            report["warnings"].append(f"{path.name}: unmatched entry rows {unmatched_entries}")
        if unmatched_exits:
            report["warnings"].append(f"{path.name}: unmatched exit rows {unmatched_exits}")
        report["files"].append({
            "file": path.name,
            "raw_rows": len(raw_orders),
            "deduplicated_rows": len(cleaned),
            "duplicates_removed": duplicate_count,
            "executed_rows": len(executed),
            "trades_created": len(file_trades),
            "unmatched_entry_rows": unmatched_entries,
            "unmatched_exit_rows": unmatched_exits,
        })
        trades.extend(file_trades)

    report["imported_trades"] = len(trades)
    return trades, report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", nargs="+", type=Path, help="Pepperstone CSV files or directories")
    parser.add_argument("-o", "--output", type=Path, required=True, help="Trading Journal CSV output path")
    parser.add_argument("--report", type=Path, help="Optional JSON conversion report path")
    args = parser.parse_args()

    paths: list[Path] = []
    for input_path in args.inputs:
        if input_path.is_dir():
            paths.extend(sorted(input_path.glob("pepperstone*.csv")))
        elif input_path.is_file():
            paths.append(input_path)
        else:
            parser.error(f"input not found: {input_path}")
    if not paths:
        parser.error("no Pepperstone CSV files found")

    try:
        trades, report = convert_paths(paths)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        writer.writerows(trades)

    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"Wrote {len(trades)} trades to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
