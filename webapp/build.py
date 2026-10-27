"""オフライン配布用の単一 HTML を作る。

CMP_LogAnalyzer.html(CDN から ExcelJS を読む版)を元に、
vendor/ のライブラリ(ExcelJS, html-to-image)を埋め込み、HTML の骨組みを付けて dist/ に出力する。
インターネットがない PC でもブラウザで開くだけで動く。

使い方: python3 build.py
"""
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "CMP_LogAnalyzer.html"
LIBS = {
    '<script src="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"></script>': ROOT / "vendor" / "exceljs.min.js",
    '<script src="https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js"></script>': ROOT / "vendor" / "html-to-image.min.js",
}
OUT = ROOT / "dist" / "CMP_LogAnalyzer_offline.html"
body = SRC.read_text(encoding="utf-8")
for tag, path in LIBS.items():
    if tag not in body:
        raise SystemExit(f"script タグが見つかりません: {tag}")
    lib = path.read_text(encoding="utf-8").replace("</script", "<\\/script")
    body = body.replace(tag, "<script>" + lib + "</script>")
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
