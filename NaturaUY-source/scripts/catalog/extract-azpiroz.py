"""Archive the user-reviewed workbook as plain data (requires openpyxl)."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import openpyxl

parser = argparse.ArgumentParser()
parser.add_argument("workbook", type=Path)
parser.add_argument("--legend-photo", type=Path)
args = parser.parse_args()
output = Path(__file__).resolve().parents[2] / "data/reference/azpiroz-2003"
output.mkdir(parents=True, exist_ok=True)
sheet = openpyxl.load_workbook(args.workbook, data_only=False)["Especies"]
headers = [cell.value for cell in sheet[1]]
rows = [dict(zip(headers, [cell.value for cell in row])) for row in list(sheet)[1:]]
assert len(rows) == 435 and {row["numero_guia"] for row in rows} == set(range(1, 436))
(output / "original.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
with (output / "original.csv").open("w", encoding="utf-8", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=headers)
    writer.writeheader()
    writer.writerows(rows)
manifest = {
    "source": "azpiroz_2003", "workbook": args.workbook.name,
    "workbookSha256": hashlib.sha256(args.workbook.read_bytes()).hexdigest(),
    "rows": 435, "userReviewed": True,
    "reviewPolicy": "La revisión del usuario reemplaza las marcas OCR de la columna revision; los valores ilegibles se conservan y se informan por campo.",
}
if args.legend_photo:
    manifest["legendPhoto"] = args.legend_photo.name
    manifest["legendPhotoSha256"] = hashlib.sha256(args.legend_photo.read_bytes()).hexdigest()
(output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Archived {len(rows)} rows")
