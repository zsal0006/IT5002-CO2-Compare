"""Export one worksheet of an .xlsx to CSV, for feeding the GIZ loader.

    python -I scripts/xlsx-to-csv.py <in.xlsx> <out.csv> [sheet-name]

Replaces the "open it in Excel and save Sheet1 as CSV" step in docs/06 §6.4,
which is the only reason that step was manual: the download is XLSX, our loader
reads CSV, and the CKAN datastore for the resource is empty so there is no CSV
to fetch.

read_only=True matters here. The GIZ sheet is one row per country by roughly
550 columns, and loading it in normal mode builds a cell object per cell;
streaming it keeps the whole job in a few MB.
"""
import csv
import sys
from pathlib import Path

from openpyxl import load_workbook


def main() -> int:
    if not 3 <= len(sys.argv) <= 4:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    src = Path(sys.argv[1])
    dest = Path(sys.argv[2])
    sheet = sys.argv[3] if len(sys.argv) == 4 else None

    if not src.is_file():
        print(f"No such file: {src}", file=sys.stderr)
        return 1

    # data_only=True returns the last value Excel cached for a formula cell
    # rather than the formula text. A sheet never opened in Excel can have no
    # cached values at all, which shows up as a column of blanks — the loader's
    # own sanity check is what would catch that.
    book = load_workbook(src, read_only=True, data_only=True)
    try:
        if sheet and sheet not in book.sheetnames:
            print(
                f"No sheet named {sheet!r}. This file has: {', '.join(book.sheetnames)}",
                file=sys.stderr,
            )
            return 1
        ws = book[sheet] if sheet else book[book.sheetnames[0]]

        dest.parent.mkdir(parents=True, exist_ok=True)
        rows = cols = 0

        # newline='' is required on Windows or every record gains a blank line.
        with dest.open("w", newline="", encoding="utf-8") as fh:
            out = csv.writer(fh)
            for row in ws.iter_rows(values_only=True):
                if row is None or all(v is None for v in row):
                    continue
                cols = max(cols, len(row))
                out.writerow(["" if v is None else v for v in row])
                rows += 1

        print(f"Sheets in file: {', '.join(book.sheetnames)}")
        print(f"Exported '{ws.title}' -> {dest}")
        print(f"  rows: {rows}   widest row: {cols} columns")
        return 0
    finally:
        book.close()


if __name__ == "__main__":
    raise SystemExit(main())
