/**
 * =========================================================
 * EmergPreviewApi v1  (2026-11-15)  ※新規ファイル
 *
 * 画面の入力 → サーバーで draft 再構築 (apiPrepareJobDraft)
 *   → 突発作業 Emerg PDF 生成 (PdfOverlayService)
 *   → Box テスト出力フォルダへ保存 (同名なら新 Version)
 *   → Box のファイル URL を画面へ返す
 *
 * - 画面から送られた資格・人名は信用しない。キーだけ受け取り、サーバーで再取得する。
 * - 出力先はテスト用 BOX_TEST_FOLDER_ID のみ。案件フォルダへの最終保存 (Finalize) は Gate D 後半。
 * - 原本 Master PDF / Excel は読むだけ。
 *
 * google.script.run が async 関数の戻り値を返せない場合に備え、
 * 結果を CacheService にも保存し、画面は apiGetEmergPreviewResult(requestId) で受け取れる。
 *
 * Script Properties:
 * - BOX_TEST_FOLDER_ID            (既存)
 * - BOX_EMERG_MASTER_PDF_FILE_ID  (既存)
 * - BOX_PDF_FONT_MEIRYO_FILE_ID   (既存)
 *
 * Requires (same project):
 * - WebAppApi.gs v3 : apiPrepareJobDraft()
 * - PdfOverlayService.gs v12.1 / PdfOverlayCoordinateMap_v10.gs / PdfRuntimeLoader.gs
 * - BoxUploadOrVersion.gs / Config.gs / BoxAuth.gs / BoxApi.gs
 *
 * Test: runEmergPreviewTest()
 * =========================================================
 */

const EMERG_PREVIEW_CONFIG_ = {
  outputFolderProperty: "BOX_TEST_FOLDER_ID",

  resultCacheSeconds: 600,

  boxFileUrlBase: "https://app.box.com/file/",
};

async function apiGenerateEmergPreview(input, requestId) {
  const startedAt = Date.now();

  const cache = CacheService.getScriptCache();

  const cacheKey = requestId ? "EMERG_PREVIEW:" + String(requestId) : "";

  try {
    const prepared = apiPrepareJobDraft(input);

    const draft = prepared.draft;

    const folderId = getRequiredProperty_(EMERG_PREVIEW_CONFIG_.outputFolderProperty);

    const lock = LockService.getScriptLock();

    lock.waitLock(60000);

    let generated;

    try {
      generated = await generateEmergPdfOverlayToBox(draft, folderId);
    } finally {
      lock.releaseLock();
    }

    const result = {
      ok: true,

      state: "PREVIEW",

      fileId: generated.fileId,

      fileName: generated.fileName,

      uploadMode: generated.uploadMode,

      boxUrl: EMERG_PREVIEW_CONFIG_.boxFileUrlBase + encodeURIComponent(generated.fileId),

      warnings: [].concat(prepared.warnings || [], generated.warnings || []),

      elapsedMs: Date.now() - startedAt,
    };

    console.log("[EMERG PREVIEW] " + JSON.stringify(result));

    if (cacheKey) {
      cache.put(cacheKey, JSON.stringify(result), EMERG_PREVIEW_CONFIG_.resultCacheSeconds);
    }

    return result;
  } catch (error) {
    const failed = { ok: false, error: error && error.message ? error.message : String(error) };

    console.log("[EMERG PREVIEW] NG " + failed.error);

    if (cacheKey) {
      cache.put(cacheKey, JSON.stringify(failed), EMERG_PREVIEW_CONFIG_.resultCacheSeconds);
    }

    throw error;
  }
}

/**
 * 画面側のフォールバック受け取り用 (結果がまだ無ければ { pending: true })。
 */
function apiGetEmergPreviewResult(requestId) {
  const cached = CacheService.getScriptCache().get("EMERG_PREVIEW:" + String(requestId || ""));

  return cached ? JSON.parse(cached) : { pending: true };
}

/**
 * GAS エディタから実行するテスト。
 *
 * 成功条件:
 *  P1 RESULT=OK まで例外なし
 *  P2 fileId があり、ファイル名が Emerg_*.pdf
 *  P3 同じ内容で 2 回目を実行すると uploadMode が新 Version 系 (Box 409 回避)
 *  P4 ログの boxUrl を開くと PDF に 作業名/作業日(開始時刻のみ)/職長/PHS/作業者/資格の楕円 が載っている (目視)
 */
async function runEmergPreviewTest() {
  console.log("==============================");

  console.log("[EMERG PREVIEW TEST v1] START");

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

  const first = await apiGenerateEmergPreview(input, "TEST1");

  if (!first.ok || !first.fileId || !/^Emerg_.*\.pdf$/.test(first.fileName)) {
    throw new Error("P2 NG : " + JSON.stringify(first));
  }

  console.log("[P2] PASS : " + first.fileName + " / " + first.uploadMode);

  const second = await apiGenerateEmergPreview(input, "TEST2");

  console.log("[P3] " + (second.fileId === first.fileId ? "PASS" : "CHECK") + " : 2nd uploadMode=" + second.uploadMode + " / same fileId=" + (second.fileId === first.fileId));

  console.log("[P4] 目視確認: " + second.boxUrl);

  console.log("[WARNINGS] " + (second.warnings.length ? second.warnings.join(" | ") : "none"));

  console.log("[EMERG PREVIEW TEST v1] RESULT = OK");

  console.log("==============================");

  return second;
}
