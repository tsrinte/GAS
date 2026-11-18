/**
 * =========================================================
 * WorkerLedgerService v1  (2026-11-16)  ※新規ファイル
 *
 * 作業者名簿台帳 (Worker Master の 作業別 Copy) を作って Box テストフォルダへ保存する。
 *
 * 原本 Worker Master は「読むだけ」。Box からダウンロードした bytes をメモリ上で書き換え、
 * 別名の xlsx として BOX_TEST_FOLDER_ID に保存する (同名なら新 Version)。
 *
 * 書き込み規則 (根拠: mapping_v5 04_Target_Mapping WK-002〜WK-005, 状態 VERIFIED):
 *   C3            = 作業名 (workTitle)                      WK-002
 *   H3            = 「作業実施日：YYYY年 M月 D日」          WK-003
 *   Z2 (Z2:Z3)    = 職長 (表示名)                           WK-004
 *   B{workerRow-1} = 「✓」 選択した作業者 (最大 6 名)       WK-005
 * それ以外のセル・書式・非表示状態は一切変更しない。
 * WK-001 (A3 フォント 11) は styles.xml の変更が必要なため v1 では未対応。
 *
 * 職長本人の行には ✓ を付けない (mapping は「選択した作業者」のみ)。← 運用確認が必要
 *
 * Script Properties:
 * - BOX_TEST_FOLDER_ID (既存)
 * - Worker Master のフォルダ Property (ReferenceDataService と同じもの。既存)
 *
 * Requires (same project):
 * - ReferenceDataService.gs v6.4 : getLatestWorkerMasterSourceCached_(), getWorkbookSheetEntryByNameFast_(), REFERENCE_DATA_CONFIG_
 * - TroubleListReader.gs v7      : unzipOfficeFile_()
 * - WebAppApi.gs v3              : apiPrepareJobDraft()
 * - BoxUploadOrVersion.gs / Config.gs / BoxAuth.gs / BoxApi.gs
 *
 * Test: runWorkerLedgerPreviewTest()
 * =========================================================
 */

const WORKER_LEDGER_CONFIG_ = {
  outputFolderProperty: "BOX_TEST_FOLDER_ID",

  titleCell: "C3",

  dateCell: "H3",

  leaderCell: "Z2",

  checkMark: "✓",

  maxWorkers: 6,

  boxFileUrlBase: "https://app.box.com/file/",

  xlsxMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * 画面から呼ぶ API。入力は Emerg と同じ (キーだけ受け取り、サーバーで draft を再構築)。
 */
function apiGenerateWorkerLedgerPreview(input) {
  const startedAt = Date.now();

  const prepared = apiPrepareJobDraft(input);

  const folderId = getRequiredProperty_(WORKER_LEDGER_CONFIG_.outputFolderProperty);

  const lock = LockService.getScriptLock();

  lock.waitLock(60000);

  let generated;

  try {
    generated = generateWorkerLedgerToBox_(prepared.draft, folderId);
  } finally {
    lock.releaseLock();
  }

  const result = {
    ok: true,

    state: "PREVIEW",

    docType: "WORKER",

    fileId: generated.fileId,

    fileName: generated.fileName,

    uploadMode: generated.uploadMode,

    boxUrl: WORKER_LEDGER_CONFIG_.boxFileUrlBase + encodeURIComponent(generated.fileId),

    written: generated.written,

    sourceFileName: generated.sourceFileName,

    warnings: [].concat(prepared.warnings || [], generated.warnings || []),

    elapsedMs: Date.now() - startedAt,
  };

  console.log("[WORKER LEDGER PREVIEW] " + JSON.stringify(result));

  return result;
}

function generateWorkerLedgerToBox_(draft, folderId) {
  const source = getLatestWorkerMasterSourceCached_();

  const built = buildWorkerLedgerXlsx_(draft, boxDownloadFile_(source.id));

  const fileName = buildWorkerLedgerFileName_(draft);

  const blob = built.blob.setName(fileName);

  const uploaded = boxUploadOrNewVersion_(folderId, fileName, blob);

  return {
    fileId: uploaded.id,

    fileName: fileName,

    uploadMode: uploaded.uploadMode,

    written: built.written,

    warnings: built.warnings,

    sourceFileName: source.name,
  };
}

/**
 * Worker Master の bytes → 書き込み済み Copy の xlsx blob。
 * (Box に触らない純粋な変換。テストしやすいよう分離)
 */
function buildWorkerLedgerXlsx_(draft, sourceBlob) {
  const warnings = [];

  const entries = unzipOfficeFile_(sourceBlob);

  const sheet = getWorkbookSheetEntryByNameFast_(entries, REFERENCE_DATA_CONFIG_.workerSheet);

  let xml = entries[sheet.path].getDataAsString("UTF-8");

  const writes = [];

  const workTitle = String(draft.workTitle || "").trim();

  if (!workTitle) {
    throw new Error("作業名が空欄のため、作業者名簿台帳を作成できません。");
  }

  writes.push([WORKER_LEDGER_CONFIG_.titleCell, workTitle]);

  writes.push([WORKER_LEDGER_CONFIG_.dateCell, buildWorkerLedgerDateText_(draft.workDate)]);

  const leaderName = String(draft.leader || "").trim();

  if (!leaderName) {
    throw new Error("職長が未選択のため、作業者名簿台帳を作成できません。");
  }

  writes.push([WORKER_LEDGER_CONFIG_.leaderCell, leaderName]);

  const workers = Array.isArray(draft.workers) ? draft.workers : [];

  if (!workers.length) {
    throw new Error("作業者が 1 人も選択されていません。");
  }

  if (workers.length > WORKER_LEDGER_CONFIG_.maxWorkers) {
    throw new Error("作業者は最大 " + WORKER_LEDGER_CONFIG_.maxWorkers + " 名です。");
  }

  const checkCells = [];

  workers.forEach(function (worker) {
    const cell = String(worker.attendanceCell || "").trim();

    if (!/^B\d+$/.test(cell)) {
      throw new Error("作業者「" + (worker.name || "") + "」の ✓ 対象セルが不正です: " + cell);
    }

    if (checkCells.indexOf(cell) !== -1) {
      throw new Error("同じ ✓ 対象セルが重複しています: " + cell);
    }

    checkCells.push(cell);

    writes.push([cell, WORKER_LEDGER_CONFIG_.checkMark]);
  });

  writes.forEach(function (write) {
    xml = setSheetCellInlineString_(xml, write[0], write[1]);
  });

  /*
   * Rebuild the zip: every original part unchanged, only the worksheet XML replaced.
   */
  const parts = Object.keys(entries).map(function (path) {
    if (path === sheet.path) {
      return Utilities.newBlob(xml, "application/xml", path);
    }

    return entries[path].setName(path);
  });

  const blob = Utilities.zip(parts, "worker_ledger.xlsx");

  blob.setContentType(WORKER_LEDGER_CONFIG_.xlsxMime);

  return {
    blob: blob,

    written: writes.map(function (write) {
      return write[0] + "=" + write[1];
    }),

    warnings: warnings,
  };
}

/**
 * "2026-11-12" -> "作業実施日：2026年 11月 12日"
 */
function buildWorkerLedgerDateText_(workDate) {
  const match = String(workDate || "")
    .trim()
    .match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);

  if (!match) {
    throw new Error("作業日の形式が不正です (YYYY-MM-DD): " + workDate);
  }

  return "作業実施日：" + Number(match[1]) + "年 " + Number(match[2]) + "月 " + Number(match[3]) + "日";
}

function buildWorkerLedgerFileName_(draft) {
  const safe = String(draft.workTitle || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return "Worker_" + (safe || "Output") + ".xlsx";
}

/**
 * Worksheet XML の 1 セルを inline 文字列に置き換える。
 * - 既存セルの書式 (s="...") は保持する。
 * - 数式セルには書き込まない (Error)。
 * - 行が無い / セルが無い場合は Error (テンプレート構造が変わった合図として扱い、勝手に作らない)。
 */
function setSheetCellInlineString_(xml, cellRef, text) {
  const rowNumber = Number(String(cellRef).replace(/^[A-Z]+/, ""));

  const rowRegex = new RegExp('<row\\b[^>]*\\br="' + rowNumber + '"[^>]*>[\\s\\S]*?</row>');

  const rowMatch = xml.match(rowRegex);

  if (!rowMatch) {
    throw new Error("Worker Master に行 " + rowNumber + " がありません (テンプレート構造が変わった可能性)。");
  }

  const rowXml = rowMatch[0];

  const cellRegex = new RegExp('<c\\b[^>]*\\br="' + cellRef + '"[^>]*?(?:/>|>[\\s\\S]*?</c>)');

  const cellMatch = rowXml.match(cellRegex);

  if (!cellMatch) {
    throw new Error("Worker Master にセル " + cellRef + " がありません (テンプレート構造が変わった可能性)。");
  }

  const cellXml = cellMatch[0];

  if (/<f[\s>]/.test(cellXml)) {
    throw new Error("セル " + cellRef + " は数式のため書き込みません。");
  }

  const style = (cellXml.match(/\bs="(\d+)"/) || [])[1];

  const escaped = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const newCell = '<c r="' + cellRef + '"' + (style ? ' s="' + style + '"' : "") + ' t="inlineStr"><is><t xml:space="preserve">' + escaped + "</t></is></c>";

  const newRow = rowXml.replace(cellXml, function () {
    return newCell;
  });

  return xml.replace(rowXml, function () {
    return newRow;
  });
}

/**
 * GAS エディタから実行するテスト。
 *
 * 成功条件:
 *  W1 RESULT=OK まで例外なし
 *  W2 fileId があり、ファイル名が Worker_*.xlsx
 *  W3 [WRITTEN] に C3 / H3 / Z2 / B{n}=✓ (作業者数ぶん) が出る
 *  W4 2 回目の実行で同じ fileId (新 Version)
 *  W5 ログの boxUrl を Excel で開き、修復メッセージなしで開けること、
 *     C3 作業名 / H3 作業実施日 / Z2 職長 / 選択作業者の B 列 ✓ を目視確認
 *  W6 原本 Worker Master (rev.xxx) は変更されていないこと (Box の更新日時)
 */
function runWorkerLedgerPreviewTest() {
  console.log("==============================");

  console.log("[WORKER LEDGER TEST v1] START");

  console.log("==============================");

  const bootstrap = apiBootstrap();

  const job = bootstrap.jobs[0];

  const loaded = apiLoadJob(job.jobKey);

  const leader =
    loaded.leaderOptions.find(function (item) {
      return item.qualificationResolved;
    }) || loaded.leaderOptions[0];

  if (!leader) {
    throw new Error("職長候補がありません。");
  }

  const workerKeys = loaded.workerOptions
    .filter(function (worker) {
      return worker.workerKey !== leader.workerKey;
    })
    .slice(0, 2)
    .map(function (worker) {
      return worker.workerKey;
    });

  const input = {
    jobKey: job.jobKey,
    workDate: loaded.jobData.workDate,
    startTime: "10:00",
    repairTroubleMode: "TROUBLE",
    leaderKey: leader.leaderKey,
    leaderPHS: leader.phs && leader.phs !== "-" ? leader.phs : "0000",
    workerKeys: workerKeys,
    workTitle: loaded.jobData.workTitle,
  };

  const first = apiGenerateWorkerLedgerPreview(input);

  if (!first.ok || !first.fileId || !/^Worker_.*\.xlsx$/.test(first.fileName)) {
    throw new Error("W2 NG : " + JSON.stringify(first));
  }

  console.log("[W2] PASS : " + first.fileName + " / " + first.uploadMode);

  console.log("[WRITTEN] " + first.written.join(" | "));

  const expected = 3 + workerKeys.length;

  if (first.written.length !== expected) {
    throw new Error("W3 NG : written=" + first.written.length + " expected=" + expected);
  }

  console.log("[W3] PASS : cells=" + first.written.length + " / source=" + first.sourceFileName);

  const second = apiGenerateWorkerLedgerPreview(input);

  console.log("[W4] " + (second.fileId === first.fileId ? "PASS" : "CHECK") + " : 2nd uploadMode=" + second.uploadMode + " / same fileId=" + (second.fileId === first.fileId));

  console.log("[W5] 目視確認 (Excel で開く): " + second.boxUrl);

  console.log("[WORKER LEDGER TEST v1] RESULT = OK");

  console.log("==============================");

  return second;
}
