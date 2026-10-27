# CMP Process Log 分析 (Web App)

- `CMP_LogAnalyzer.html` … 本体(ExcelJS を CDN から読む版。プレビュー・開発用)
- `dist/CMP_LogAnalyzer_offline.html` … 配布用。ExcelJS を埋め込んだ単一ファイルで、インターネットがない PC でもダブルクリックで動く
- `build.py` … 本体から配布用を作る(`python3 webapp/build.py`)
- `vendor/exceljs.min.js` … ExcelJS 4.4.0(MIT, `exceljs.LICENSE`)

使い方: 「ログ取込」タブで日付フォルダ(または Start Log フォルダ)を選ぶかドロップ → ダッシュボードに反映。
Sequence 挿入タブで手元の Sequence .xlsx を開き、行を選んで挿入 → 別名で保存。
