"""オフライン配布用の単一 HTML を作る。

CMP_LogAnalyzer.html(CDN から ExcelJS を読む版)を元に、
vendor/exceljs.min.js を埋め込み、HTML の骨組みを付けて dist/ に出力する。
インターネットがない PC でもブラウザで開くだけで動く。

使い方: python3 build.py
"""
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "CMP_LogAnalyzer.html"
LIB = ROOT / "vendor" / "exceljs.min.js"
OUT = ROOT / "dist" / "CMP_LogAnalyzer_offline.html"
CDN_TAG = '<script src="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"></script>'

src = SRC.read_text(encoding="utf-8")
if CDN_TAG not in src:
    raise SystemExit("ExcelJS の script タグが見つかりません")
lib = LIB.read_text(encoding="utf-8").replace("</script", "<\\/script")
body = src.replace(CDN_TAG, "<script>" + lib + "</script>")
html = (
    "<!doctype html>\n<html lang=\"ja\">\n<head>\n<meta charset=\"utf-8\">\n"
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n"
    "<style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}"
    "body{margin:0;font-size:14px}img{max-width:100%}[hidden]{display:none!important}</style>\n"
    "</head>\n<body>\n" + body + "\n</body>\n</html>\n"
)
OUT.parent.mkdir(exist_ok=True)
OUT.write_text(html, encoding="utf-8")
print(f"{OUT} ({OUT.stat().st_size / 1024:.0f} KB)")
