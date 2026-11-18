/**
 * =========================================================
 * ReferenceDataService v6.4 NoHiddenRowLookup  (2026-11-15, base = v6.3)
 *
 * v6.4 (only): 非表示行を職長の資格照合に使わない (ユーザー決定)。v6.3 の該当処理を削除。
 *   非表示行は従来どおり作業者候補にも出さない。
 *
 * ---- v6.3 (2026-11-15, base = v6.2) ※資格照合への利用は v6.4 で取り消し ----
 *
 * v6.3 (only): Worker Master の非表示行は作業者候補に出さないが、職長の資格照合にだけ使う
 *   (表示行で見つからない場合のみ)。根拠: 2026-11-15 診断ログ 方田=row 287/288 hidden。
 *   cache key WORKER_FAST_V4。
 *
 * ---- v6.2 (2026-11-15, base = v6.1) ----
 *
 * v6.2 (only): 職長照合に full-name 前方一致を追加 / 同姓複数(樋口)は 1人ずつ選択肢化
 *   (表示 樋口友・樋口遼) / runWorkerNameDiagnostic() 追加。
 *
 * ---- v6.1 (2026-11-15, base = v6) ----
 *
 * v6.1 (only): 職長↔Worker 照合時に異体字を統一 (瀨→瀬 等)。表示名は原文のまま。
 *   根拠: 2026-11-15 GAS ログで 職長「瀨古」(U+7028) matchCount=0。
 *
 * ---- v6 (2026-11-12, base = v5 AllSectionsLeaderMatch) ----
 *
 * v6 changes (only):
 * 1) sharedStrings: <rPh>(ふりがな)를 값에서 제외하고 별도 phonetic 배열로 보관.
 *    v5는 "佐藤１" + rPh "サトウ" → "佐藤１サトウ"로 오염되어 full-name 매칭이 깨졌다.
 * 2) Worker 2행 1세트 판정 수정.
 *    v5는 모든 행을 name row 후보로 보아, 상단(フリガナ) 행도 작업자로 등록하고
 *    그 자격을 이전 사람 행(r-1)에서 읽었다.
 *    v6: name row = E 있음 + C/G/I/J/K/L 없음, detail row(r-1) = C/G/I/J/K/L 중 하나 이상.
 *    name row / detail row 중 하나라도 hidden이면 제외.
 * 3) 동명이인 병합 금지.
 *    v5는 같은 fullName의 다른 행을 1명으로 합쳐 자격을 OR 결합하고 ✓ 대상 B셀을 여러 개로 만들었다.
 *    v6: 행 단위로 1명. duplicateFullName / displayLabel로 UI에서 구분.
 * 4) 職長 kana 좁히기: Info2026 이름 셀의 rPh(ふりがな)를 leader.kana로 사용.
 * 5) cache key: WORKER_FAST_V3 / INFO_LEADERS_V3 (v5 오염 캐시 재사용 방지)
 *
 * Performance objective:
 * - Info2026에서 지정된 2개 시트만 사용
 *   1) 装置情報
 *   2) 職長_PHS
 * - 装置情報 전체를 generic matrix/object로 만들지 않음
 * - 요청된 machineId의 1행만 찾고 즉시 종료
 * - 職長_PHS는 A:E만 읽음
 * - sharedStrings.xml은 XmlService 대신 경량 parser 사용
 * - Worker Master도 지정 시트/필요 행/필요 열만 읽음
 * - E:F merged worker-name cell is read from E (OpenXML merge anchor)
 * - Worker display name = surname only
 * - qualifications = I/J/K/L on qualification row (nameRow - 1)
 * - repeated ledger sections across the whole sheet are auto-scanned
 * - leader matching uses full name -> surname -> furigana narrowing
 *
 * Script Properties:
 * - BOX_INFO2026_FILE_ID
 * - BOX_WORKER_MASTER_FOLDER_ID
 *
 * Requires:
 * - TroubleListReader v6:
 *   unzipOfficeFile_()
 *   listWorkbookWorksheets_()
 *   listTroubleListFolderFiles_()
 *   cleanCellText_()
 *   normalizeTroubleDisplayText_()
 * - JobDataService v2:
 *   loadBaseJobData()
 * =========================================================
 */

const REFERENCE_DATA_CONFIG_ = {
  infoFileProperty: "BOX_INFO2026_FILE_ID",

  workerFolderProperty: "BOX_WORKER_MASTER_FOLDER_ID",

  workerFileNameRegex: /安全管理体制図.*\.(?:xlsx|xlsm)$/i,

  infoDeviceSheet: "装置情報",

  infoLeaderSheet: "職長_PHS",

  workerSheet: "作業者名簿台帳装置",

  deviceCacheSeconds: 3600,

  leaderCacheSeconds: 600,

  workerCacheSeconds: 300,

  workerSourceCacheSeconds: 60,
};

/**
 * Web/backend public API.
 */
function getReferenceDataForJob(jobKey) {
  const startedAt = Date.now();

  const base = loadBaseJobData(jobKey);

  console.log("[REF FAST] BASE_JOB_DATA ready / ms=" + (Date.now() - startedAt));

  const infoStartedAt = Date.now();

  const info = getInfo2026ForMachineFast_(base.machineId);

  console.log("[REF FAST] INFO2026 ready / ms=" + (Date.now() - infoStartedAt));

  const rawLeaderOptions = filterLeaderOptions_(info.leaders, base.environment);

  const workerStartedAt = Date.now();

  const workerMaster = getWorkerMasterFastCached_();

  console.log("[REF FAST] WORKER MASTER ready / ms=" + (Date.now() - workerStartedAt));

  const leaderOptions = attachLeaderWorkerMasterData_(rawLeaderOptions, workerMaster.workers, workerMaster.hiddenWorkers || []);

  const warnings = [].concat(base.warnings || []);

  if (!info.device.found) {
    warnings.push("Info2026 装置情報에서 装置ID " + base.machineId + " 를 찾지 못했습니다.");
  }

  if (!leaderOptions.length) {
    warnings.push("환경 " + base.environment + " 에 대응 가능한 職長候補를 찾지 못했습니다.");
  }

  if (!workerMaster.workers.length) {
    warnings.push("Worker Master에서 유효한 작업자를 찾지 못했습니다.");
  }

  const record = info.device.record;

  const jobData = Object.assign({}, base, {
    dataState: "JOB_DATA_READY",

    customerName: record ? record.customerName : "",

    workLocation: record ? record.workLocation : "",

    serialNo: record ? record.serialNo : "",

    oldSerial: record ? record.oldSerial : "",

    warnings: warnings,
  });

  console.log("[REF FAST] TOTAL / ms=" + (Date.now() - startedAt));

  return {
    ok: true,

    dataState: "JOB_DATA_READY",

    jobData: jobData,

    reference: {
      info2026: {
        fileId: info.fileId,

        deviceFound: info.device.found,

        deviceMatchCount: info.device.matchCount,

        leaderCount: info.leaders.length,
      },

      workerMaster: {
        fileId: workerMaster.fileId,

        fileName: workerMaster.fileName,

        modifiedAt: workerMaster.modifiedAt,

        workerCount: workerMaster.workers.length,
      },
    },

    leaderOptions: leaderOptions,

    workerOptions: workerMaster.workers,
  };
}

/**
 * =========================================================
 * Info2026 FAST
 * =========================================================
 *
 * IMPORTANT:
 * We do not create a 6,000+ row device array.
 *
 * Cache:
 * - one machine lookup per machineId
 * - compact leader list
 */
function getInfo2026ForMachineFast_(machineId) {
  const fileId = getRequiredProperty_(REFERENCE_DATA_CONFIG_.infoFileProperty);

  const cache = CacheService.getScriptCache();

  const normalizedMachineId = String(machineId || "")
    .trim()
    .toUpperCase();

  const deviceKey = "INFO_DEVICE_V2:" + fileId + ":" + normalizedMachineId;

  const leaderKey = "INFO_LEADERS_V3:" + fileId;

  const cachedDevice = getJsonCacheSafe_(cache, deviceKey);

  const cachedLeaders = getJsonCacheSafe_(cache, leaderKey);

  if (cachedDevice && cachedLeaders) {
    console.log("[INFO2026 FAST CACHE] HIT / device + leaders");

    return {
      fileId: String(fileId),

      device: cachedDevice,

      leaders: cachedLeaders,
    };
  }

  console.log("[INFO2026 FAST CACHE] MISS");

  const downloadStartedAt = Date.now();

  const blob = boxDownloadFile_(fileId);

  const entries = unzipOfficeFile_(blob);

  console.log("[INFO2026 FAST] download+unzip / ms=" + (Date.now() - downloadStartedAt));

  /*
   * Small workbook.xml + rels only.
   * This does NOT parse all worksheet contents.
   */
  const deviceSheet = getWorkbookSheetEntryByNameFast_(entries, REFERENCE_DATA_CONFIG_.infoDeviceSheet);

  const leaderSheet = getWorkbookSheetEntryByNameFast_(entries, REFERENCE_DATA_CONFIG_.infoLeaderSheet);

  /*
   * sharedStrings.xml is workbook-global, but we parse it with
   * a lightweight string parser instead of XmlService.
   */
  const sharedStartedAt = Date.now();

  const sharedStrings = parseSharedStringsFast_(entries);

  console.log("[INFO2026 FAST] sharedStrings / count=" + sharedStrings.length + " / ms=" + (Date.now() - sharedStartedAt));

  let device = cachedDevice;

  if (!device) {
    const deviceStartedAt = Date.now();

    device = findInfo2026DeviceFast_(entries[deviceSheet.path].getDataAsString("UTF-8"), sharedStrings, normalizedMachineId);

    console.log("[INFO2026 FAST] 装置情報 lookup / found=" + device.found + " / ms=" + (Date.now() - deviceStartedAt));

    putJsonCacheSmall_(cache, deviceKey, device, REFERENCE_DATA_CONFIG_.deviceCacheSeconds, "INFO_DEVICE");
  }

  let leaders = cachedLeaders;

  if (!leaders) {
    const leaderStartedAt = Date.now();

    leaders = extractInfo2026LeadersFast_(entries[leaderSheet.path].getDataAsString("UTF-8"), sharedStrings);

    console.log("[INFO2026 FAST] 職長_PHS / count=" + leaders.length + " / ms=" + (Date.now() - leaderStartedAt));

    putJsonCacheSmall_(cache, leaderKey, leaders, REFERENCE_DATA_CONFIG_.leaderCacheSeconds, "INFO_LEADERS");
  }

  return {
    fileId: String(fileId),

    device: device,

    leaders: leaders,
  };
}

/**
 * 装置情報:
 * Only columns A/B/E/F/G are inspected.
 *
 * A = 装置ID
 * B = serialNo
 * E = customerName
 * F = workLocation
 * G = oldSerial
 *
 * Stops immediately after matching the requested machineId.
 */
function findInfo2026DeviceFast_(xml, sharedStrings, targetMachineId) {
  const wantedColumns = {
    A: true,

    B: true,

    E: true,

    F: true,

    G: true,
  };

  const rowRegex = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;

  let rowMatch;

  let matchCount = 0;

  let firstRecord = null;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const attrs = rowMatch[1];

    const rowNumberMatch = attrs.match(/\br="(\d+)"/);

    const rowNumber = rowNumberMatch ? Number(rowNumberMatch[1]) : 0;

    if (rowNumber <= 1) {
      continue;
    }

    const cells = readSelectedCellsFast_(rowMatch[2], wantedColumns, sharedStrings);

    const machineId = cleanCellText_(cells.A).toUpperCase();

    if (!machineId || machineId !== targetMachineId) {
      continue;
    }

    matchCount++;

    if (!firstRecord) {
      firstRecord = {
        rowNumber: rowNumber,

        machineId: cleanCellText_(cells.A),

        serialNo: cleanCellText_(cells.B),

        customerName: normalizeReferenceDisplayText_(cells.E),

        workLocation: normalizeReferenceDisplayText_(cells.F),

        oldSerial: cleanCellText_(cells.G),
      };
    }

    /*
     * Machine ID should be unique.
     * For speed we return after the first exact match.
     */
    break;
  }

  return {
    found: Boolean(firstRecord),

    matchCount: matchCount,

    record: firstRecord,
  };
}

/**
 * 職長_PHS:
 * Only A:E.
 */
function extractInfo2026LeadersFast_(xml, sharedStrings) {
  const leaders = [];

  const wantedColumns = {
    A: true,

    B: true,

    C: true,

    D: true,

    E: true,
  };

  const rowRegex = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;

  let rowMatch;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const attrs = rowMatch[1];

    const rowNumberMatch = attrs.match(/\br="(\d+)"/);

    const rowNumber = rowNumberMatch ? Number(rowNumberMatch[1]) : 0;

    if (rowNumber <= 1) {
      continue;
    }

    const cells = readSelectedCellsFast_(rowMatch[2], wantedColumns, sharedStrings);

    const nameRaw = normalizeReferenceDisplayText_(cells.A);

    const name = extractLeaderDisplayName_(nameRaw);

    if (!name) {
      continue;
    }

    leaders.push({
      leaderKey: [name, rowNumber].join("|"),

      /*
       * v6: ふりがな from Excel phonetic guide (rPh), used only for narrowing.
       */
      kana: normalizeKanaForMatch_(readCellPhoneticFast_(rowMatch[2], "A", sharedStrings)),

      rowNumber: rowNumber,

      name: name,

      nameRaw: nameRaw,

      phs: cleanCellText_(cells.B) || "-",

      eligibility: {
        "300X": hasReferenceValue_(cells.C),

        "300E": hasReferenceValue_(cells.D),

        BEVEL: hasReferenceValue_(cells.E),
      },
    });
  }

  return leaders;
}

function filterLeaderOptions_(leaders, environment) {
  const env = String(environment || "").toUpperCase();

  return leaders
    .filter(function (leader) {
      if (env === "BEVEL") {
        return Boolean(leader.eligibility.BEVEL);
      }

      if (env === "300X" || env === "300E") {
        return Boolean(leader.eligibility[env]);
      }

      return true;
    })
    .map(function (leader) {
      return {
        leaderKey: leader.leaderKey,

        name: leader.name,

        nameRaw: leader.nameRaw || leader.name,

        kana: leader.kana || "",

        phs: leader.phs,

        eligibility: leader.eligibility,
      };
    });
}

/**
 * =========================================================
 * Worker Master FAST
 * =========================================================
 *
 * Reads only:
 * - sheet 作業者名簿台帳装置
 * - rows 21..198
 * - E / I:J:K:L
 */
function getWorkerMasterFastCached_() {
  const source = getLatestWorkerMasterSourceCached_();

  const cache = CacheService.getScriptCache();

  const key = ["WORKER_FAST_V4", source.id, source.modifiedAt || ""].join(":");

  const cached = getJsonCacheSafe_(cache, key);

  if (cached) {
    console.log("[WORKER FAST CACHE] HIT / workers=" + cached.workers.length);

    return cached;
  }

  console.log("[WORKER FAST CACHE] MISS");

  const downloadStartedAt = Date.now();

  const blob = boxDownloadFile_(source.id);

  const entries = unzipOfficeFile_(blob);

  console.log("[WORKER FAST] download+unzip / ms=" + (Date.now() - downloadStartedAt));

  const sheet = getWorkbookSheetEntryByNameFast_(entries, REFERENCE_DATA_CONFIG_.workerSheet);

  const sharedStrings = parseSharedStringsFast_(entries);

  const xml = entries[sheet.path].getDataAsString("UTF-8");

  const workers = extractWorkerOptionsFast_(xml, sharedStrings);

  const result = {
    fileId: source.id,

    fileName: source.name,

    modifiedAt: source.modifiedAt,

    workers: workers,

    hiddenWorkers: workers.hiddenWorkers || [],
  };

  putJsonCacheSmall_(cache, key, result, REFERENCE_DATA_CONFIG_.workerCacheSeconds, "WORKER_FAST_V4");

  return result;
}

function getLatestWorkerMasterSourceCached_() {
  const folderId = getRequiredProperty_(REFERENCE_DATA_CONFIG_.workerFolderProperty);

  const cache = CacheService.getScriptCache();

  const key = "WORKER_SOURCE:" + folderId;

  const cached = getJsonCacheSafe_(cache, key);

  if (cached) {
    return cached;
  }

  const items = listTroubleListFolderFiles_(folderId);

  const regex = REFERENCE_DATA_CONFIG_.workerFileNameRegex;

  const candidates = items
    .filter(function (item) {
      regex.lastIndex = 0;

      return item.type === "file" && regex.test(String(item.name || ""));
    })
    .sort(function (a, b) {
      return new Date(b.modified_at || 0).getTime() - new Date(a.modified_at || 0).getTime();
    });

  if (!candidates.length) {
    throw new Error("BOX_WORKER_MASTER_FOLDER_ID에서 안전管理体制図 Master를 찾지 못했습니다.");
  }

  const latest = candidates[0];

  const source = {
    id: String(latest.id),

    name: latest.name,

    modifiedAt: latest.modified_at || "",
  };

  putJsonCacheSmall_(cache, key, source, REFERENCE_DATA_CONFIG_.workerSourceCacheSeconds, "WORKER_SOURCE");

  return source;
}

function extractWorkerOptionsFast_(xml, sharedStrings) {
  const rows = {};

  const rowRegex = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;

  let rowMatch;

  let maxRow = 0;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const attrs = rowMatch[1] || "";

    const rowNumberMatch = attrs.match(/\br="(\d+)"/);

    if (!rowNumberMatch) {
      continue;
    }

    const rowNumber = Number(rowNumberMatch[1]);

    maxRow = Math.max(maxRow, rowNumber);

    rows[rowNumber] = {
      hidden: /\bhidden="1"/.test(attrs),

      cells: readSelectedCellsFast_(rowMatch[2], { B: true, C: true, E: true, G: true, I: true, J: true, K: true, L: true }, sharedStrings),
    };
  }

  /*
   * v6 pair rule (verified against 作業者名簿台帳装置 sample + DEV screenshot):
   *
   *   detail row (r-1) : C=会社名, E=フリガナ, G/H=区分/血液型, I/J/K/L=資格, B=入場者確認(✓ target)
   *   name row   (r)   : E=氏名 only
   *
   * A row that has C/G/I/J/K/L is a detail row and can never be a name row.
   * Both rows must be visible.
   */
  function hasDetail_(row) {
    return ["C", "G", "I", "J", "K", "L"].some(function (column) {
      return Boolean(cleanCellText_(row.cells[column]));
    });
  }

  const workers = [];

  const hiddenWorkers = [];

  const skipped = { hidden: 0, notPair: 0 };

  for (let r = 2; r <= maxRow; r++) {
    const nameRow = rows[r];

    const detailRow = rows[r - 1];

    if (!nameRow || !detailRow) {
      continue;
    }

    const rawName = cleanCellText_(nameRow.cells.E);

    if (!rawName || rawName.indexOf("氏名") !== -1) {
      continue;
    }

    if (hasDetail_(nameRow) || !hasDetail_(detailRow)) {
      skipped.notPair++;

      continue;
    }

    if (!/[一-龯々ぁ-んァ-ヶー]/.test(rawName)) {
      continue;
    }

    /*
     * v6.3: hidden pairs are never worker candidates,
     * but are kept separately for 職長 qualification lookup only.
     */
    const isHiddenPair = Boolean(nameRow.hidden || detailRow.hidden);

    if (isHiddenPair) {
      skipped.hidden++;
    }

    const targetList = isHiddenPair ? hiddenWorkers : workers;

    const fullName = normalizeWorkerFullName_(rawName);

    const furiganaRaw = cleanCellText_(detailRow.cells.E);

    targetList.push({
      hiddenRow: isHiddenPair,

      workerKey: [fullName, r].join("|"),

      name: extractWorkerSurname_(rawName),

      fullName: fullName,

      nameRaw: rawName,

      furigana: normalizeKanaForMatch_(furiganaRaw),

      furiganaRaw: furiganaRaw,

      company: cleanCellText_(detailRow.cells.C),

      phs: "-",

      qualifications: {
        gas: hasQualificationValue_(detailRow.cells.I),

        electric: hasQualificationValue_(detailRow.cells.J),

        leader: hasQualificationValue_(detailRow.cells.K),

        law60: hasQualificationValue_(detailRow.cells.L),
      },

      sourceNameRow: r,

      sourceQualificationRow: r - 1,

      attendanceCell: "B" + (r - 1),

      /*
       * Kept for WebAppApi v3 compatibility. Always exactly one cell in v6.
       */
      attendanceCells: ["B" + (r - 1)],
    });
  }

  /*
   * v6: never merge different rows.
   * Same full name on different rows can be different people
   * (DEV screenshot: 佐藤10 x3 with different furigana and different 資格).
   */
  const fullNameCount = {};

  const surnameCount = {};

  workers.forEach(function (worker) {
    const fullKey = normalizePersonNameForReferenceMatch_(worker.fullName);

    fullNameCount[fullKey] = (fullNameCount[fullKey] || 0) + 1;

    surnameCount[worker.name] = (surnameCount[worker.name] || 0) + 1;
  });

  workers.forEach(function (worker) {
    const fullKey = normalizePersonNameForReferenceMatch_(worker.fullName);

    worker.duplicateFullName = fullNameCount[fullKey] > 1;

    worker.duplicateSurname = surnameCount[worker.name] > 1;

    /*
     * UI label: surname only when unique (spec), otherwise add what distinguishes the person.
     */
    let label = worker.name;

    if (worker.duplicateSurname) {
      label = worker.fullName;
    }

    if (worker.duplicateFullName) {
      label = worker.fullName + (worker.furiganaRaw ? "（" + worker.furiganaRaw + "）" : "") + " 行" + worker.sourceNameRow;
    }

    worker.displayLabel = label;
  });

  const duplicateCount = workers.filter(function (worker) {
    return worker.duplicateFullName;
  }).length;

  console.log(
    "[WORKER FAST v6] scanned rows=" +
      maxRow +
      " / workers=" +
      workers.length +
      " / duplicateFullNameRows=" +
      duplicateCount +
      " / skipped hidden=" +
      skipped.hidden,
  );

  /*
   * v6.3: hidden pairs ride along as a non-enumerable-in-UI property.
   */
  workers.hiddenWorkers = hiddenWorkers;

  return workers;
}

/**
 * =========================================================
 * FAST OpenXML helpers
 * =========================================================
 */

function getWorkbookSheetEntryByNameFast_(entries, sheetName) {
  const sheets = listWorkbookWorksheets_(entries);

  const found = sheets.find(function (sheet) {
    return sheet.name === sheetName;
  });

  if (!found) {
    throw new Error("Workbook sheet를 찾지 못했습니다: " + sheetName);
  }

  if (!entries[found.path]) {
    throw new Error("Worksheet XML을 찾지 못했습니다: " + found.path);
  }

  return found;
}

/**
 * Fast shared-string parser.
 * Avoids XmlService.parse() on the workbook-global sharedStrings.xml.
 */
function parseSharedStringsFast_(entries) {
  const blob = entries["xl/sharedStrings.xml"];

  if (!blob) {
    return [];
  }

  const xml = blob.getDataAsString("UTF-8");

  const strings = [];

  /*
   * v6: phonetic (rPh) text is kept separately.
   * strings[i]          = displayed cell text
   * strings.phonetic[i] = ふりがな (may be "")
   */
  const phonetic = [];

  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;

  let siMatch;

  while ((siMatch = siRegex.exec(xml)) !== null) {
    const body = siMatch[1];

    let reading = "";

    const rphRegex = /<rPh\b[^>]*>([\s\S]*?)<\/rPh>/g;

    let rphMatch;

    while ((rphMatch = rphRegex.exec(body)) !== null) {
      reading += collectXmlTextFast_(rphMatch[1]);
    }

    const visibleBody = body.replace(/<rPh\b[^>]*>[\s\S]*?<\/rPh>/g, "").replace(/<phoneticPr\b[^>]*\/>/g, "");

    strings.push(collectXmlTextFast_(visibleBody));

    phonetic.push(reading);
  }

  strings.phonetic = phonetic;

  return strings;
}

function collectXmlTextFast_(xmlFragment) {
  let value = "";

  const textRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;

  let textMatch;

  while ((textMatch = textRegex.exec(xmlFragment)) !== null) {
    value += decodeXmlTextFast_(textMatch[1]);
  }

  return value;
}

/**
 * v6: ふりがな of one shared-string cell (column letter) in a row.
 */
function readCellPhoneticFast_(rowXml, column, sharedStrings) {
  const phonetic = sharedStrings && sharedStrings.phonetic;

  if (!phonetic) {
    return "";
  }

  const regex = new RegExp('<c\\b[^>]*\\br="' + column + '\\d+"[^>]*\\bt="s"[^>]*>\\s*<v>(\\d+)<\\/v>');

  const match = rowXml.match(regex);

  return match ? String(phonetic[Number(match[1])] || "") : "";
}

/**
 * Read only selected columns from one row's XML.
 */
function readSelectedCellsFast_(rowXml, wantedColumns, sharedStrings) {
  const values = {};

  /*
   * IMPORTANT:
   *
   * Excel rows contain many empty self-closing cells:
   *   <c r="A22" s="102"/>
   *
   * and populated cells:
   *   <c r="E22" s="185" t="s"><v>535</v></c>
   *
   * The old regex matched from A22 through E22's </c>,
   * so E22 itself was never seen as an independent cell.
   *
   * This regex consumes self-closing and normal cells separately.
   */
  const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

  let cellMatch;

  while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
    const attrs = cellMatch[1] || "";

    const body = cellMatch[2] || "";

    const refMatch = attrs.match(/\br="([A-Z]+)\d+"/);

    if (!refMatch) {
      continue;
    }

    const column = refMatch[1];

    if (!wantedColumns[column]) {
      continue;
    }

    values[column] = readCellValueFast_(attrs, body, sharedStrings);
  }

  return values;
}

function readCellValueFast_(attrs, body, sharedStrings) {
  const typeMatch = attrs.match(/\bt="([^"]+)"/);

  const type = typeMatch ? typeMatch[1] : "";

  if (type === "inlineStr") {
    return collectXmlTextFast_(body.replace(/<rPh\b[^>]*>[\s\S]*?<\/rPh>/g, ""));
  }

  const valueMatch = body.match(/<v>([\s\S]*?)<\/v>/);

  if (!valueMatch) {
    return "";
  }

  const raw = decodeXmlTextFast_(valueMatch[1]);

  if (type === "s") {
    const index = Number(raw);

    return sharedStrings[index] !== undefined ? sharedStrings[index] : "";
  }

  if (type === "b") {
    return raw === "1";
  }

  return raw;
}

function decodeXmlTextFast_(value) {
  return String(value || "")
    .replace(/&#x([0-9A-Fa-f]+);/g, function (whole, hex) {
      return String.fromCodePoint(parseInt(hex, 16));
    })
    .replace(/&#(\d+);/g, function (whole, decimal) {
      return String.fromCodePoint(Number(decimal));
    })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * =========================================================
 * Normalization / qualification / cache
 * =========================================================
 */

function normalizeReferenceDisplayText_(value) {
  const source = cleanCellText_(value);

  /*
   * NFKC is intentionally used for reference/master display text:
   * - ｷｵｸｼｱ -> キオクシア
   * - full-width ASCII -> half-width ASCII
   * - Japanese Kanji/Kana content remains readable
   */
  const normalized = source.normalize ? source.normalize("NFKC") : source;

  return normalizeTroubleDisplayText_(normalized).replace(/\s+/g, " ").trim();
}

/**
 * Info2026 職長 display name.
 * Remove trailing Katakana reading / given-name part and show surname only.
 *
 * Examples:
 *   瀬古セコ      -> 瀬古
 *   加茂 雅之     -> 加茂
 *   加茂 雅之カモ -> 加茂
 */
function extractLeaderDisplayName_(value) {
  return extractWorkerSurname_(value);
}

/**
 * Attach Worker Master qualifications to each leader option.
 * Exact normalized full-name match is attempted first, then unique surname.
 * No guessing when multiple workers share the same surname.
 */
function attachLeaderWorkerMasterData_(leaders, workers, hiddenWorkers) {
  const result = [];

  leaders.forEach(function (leader) {
    const options = matchLeaderToWorkers_(leader, workers);

    /*
     * v6.4: 非表示行 (hidden row) は資格照合に使わない (2026-11-15 ユーザー決定)。
     * 非表示行にしか居ない職長は「未照合」のまま表示し、資格の楕円は出力しない。
     */

    options.forEach(function (option) {
      result.push(option);
    });
  });

  return result;
}

/**
 * v6.3: one 職長 against one worker list -> selectable option(s).
 */
function matchLeaderToWorkers_(leader, workers) {
  const options = [];

  const leaderRaw = normalizeWorkerFullName_(leader.nameRaw || leader.name);

  const leaderDisplay = extractLeaderDisplayName_(leaderRaw);

  const leaderKana = leader.kana || extractTrailingLeaderKana_(leaderRaw);

  const leaderKey = normalizePersonNameForReferenceMatch_(leaderRaw);

  /*
   * 1) Exact normalized full-name match.
   */
  let matches = workers.filter(function (worker) {
    return normalizePersonNameForReferenceMatch_(worker.fullName || worker.name) === leaderKey;
  });

  /*
   * 2) Surname match.
   */
  if (matches.length !== 1) {
    matches = workers.filter(function (worker) {
      return normalizePersonNameForReferenceMatch_(worker.name) === normalizePersonNameForReferenceMatch_(leaderDisplay);
    });
  }

  /*
   * 3) v6.2: prefix match on the full name (spaces removed).
   *    Info2026 "樋口友" -> Worker "樋口 友○" / Worker "方田○○" (no space) -> Info2026 "方田"
   */
  if (matches.length === 0) {
    matches = workers.filter(function (worker) {
      return normalizePersonNameForReferenceMatch_(worker.fullName || worker.name).indexOf(leaderKey) === 0;
    });
  }

  /*
   * 4) Several candidates + Info2026 phonetic (rPh) -> narrow by furigana.
   */
  if (matches.length > 1 && leaderKana) {
    const kanaMatches = matches.filter(function (worker) {
      const workerKana = normalizeKanaForMatch_(worker.furigana || worker.furiganaRaw || "");

      return workerKana.indexOf(leaderKana) === 0;
    });

    if (kanaMatches.length === 1) {
      matches = kanaMatches;
    }
  }

  if (matches.length <= 1) {
    const matched = matches.length === 1 ? matches[0] : null;

    options.push(
      Object.assign({}, leader, {
        name: leaderDisplay,
        workerKey: matched ? matched.workerKey : "",
        workerFullName: matched ? matched.fullName : "",
        qualifications: matched ? matched.qualifications : {},
        qualificationResolved: Boolean(matched),
        qualificationMatchCount: matches.length,
        expandedFromAmbiguous: false,
      }),
    );

    return options;
  }

  /*
   * 5) v6.2: still ambiguous (e.g. Info2026 "樋口" = Worker 樋口友○ / 樋口遼○).
   *    One selectable 職長 per person, labelled surname + shortest unique given-name prefix
   *    (樋口友 / 樋口遼). PHS comes from the single Info2026 row: user must check it.
   */
  const labels = buildDisambiguatedLeaderLabels_(matches);

  matches.forEach(function (worker, index) {
    options.push(
      Object.assign({}, leader, {
        leaderKey: leader.leaderKey + "#" + worker.workerKey,
        name: labels[index],
        workerKey: worker.workerKey,
        workerFullName: worker.fullName,
        qualifications: worker.qualifications,
        qualificationResolved: true,
        qualificationMatchCount: matches.length,
        expandedFromAmbiguous: true,
        phsNeedsCheck: true,
      }),
    );
  });

  return options;
}

/**
 * v6.2: 樋口 友也 / 樋口 遼太 -> ["樋口友", "樋口遼"]
 */
function buildDisambiguatedLeaderLabels_(workers) {
  const parts = workers.map(function (worker) {
    const full = normalizeWorkerFullName_(worker.fullName || worker.name);

    const surname = worker.name || extractWorkerSurname_(full);

    let given = full.indexOf(" ") !== -1 ? full.split(" ").slice(1).join("") : full.substring(surname.length);

    return { surname: surname, given: Array.from(given) };
  });

  const maxLength = Math.max.apply(
    null,
    parts.map(function (part) {
      return part.given.length;
    }),
  );

  for (let length = 1; length <= maxLength; length++) {
    const labels = parts.map(function (part) {
      return part.surname + part.given.slice(0, length).join("");
    });

    if (new Set(labels).size === labels.length) {
      return labels;
    }
  }

  return parts.map(function (part, index) {
    return part.surname + part.given.join("") + " (" + (index + 1) + ")";
  });
}

/**
 * =========================================================
 * v6.2 Diagnostic: Worker Master 행 직접 조회
 * 사용법: WORKER_DIAG_NAME_ 을 바꾸고 runWorkerNameDiagnostic 실행.
 * 원본은 읽기만 함.
 * =========================================================
 */
const WORKER_DIAG_NAME_ = "方田";

function runWorkerNameDiagnostic() {
  const target = normalizePersonNameForReferenceMatch_(WORKER_DIAG_NAME_);

  const source = getLatestWorkerMasterSourceCached_();

  const entries = unzipOfficeFile_(boxDownloadFile_(source.id));

  const sheet = getWorkbookSheetEntryByNameFast_(entries, REFERENCE_DATA_CONFIG_.workerSheet);

  const sharedStrings = parseSharedStringsFast_(entries);

  const xml = entries[sheet.path].getDataAsString("UTF-8");

  const rows = {};

  const rowRegex = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;

  let rowMatch;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const number = Number((rowMatch[1].match(/\br="(\d+)"/) || [])[1] || 0);

    rows[number] = {
      hidden: /\bhidden="1"/.test(rowMatch[1]),
      cells: readSelectedCellsFast_(rowMatch[2], { B: true, C: true, E: true, G: true, I: true, J: true, K: true, L: true }, sharedStrings),
    };
  }

  let hits = 0;

  Object.keys(rows).forEach(function (key) {
    const r = Number(key);

    const e = normalizePersonNameForReferenceMatch_(rows[r].cells.E);

    if (!e || e.indexOf(target) === -1) {
      return;
    }

    hits++;

    console.log("[DIAG] row " + r + (rows[r].hidden ? " (hidden)" : "") + " = " + JSON.stringify(rows[r].cells));

    if (rows[r - 1]) {
      console.log("[DIAG]   row " + (r - 1) + (rows[r - 1].hidden ? " (hidden)" : "") + " = " + JSON.stringify(rows[r - 1].cells));
    }
  });

  const workers = getWorkerMasterFastCached_().workers.filter(function (worker) {
    return normalizePersonNameForReferenceMatch_(worker.fullName).indexOf(target) !== -1;
  });

  console.log("[DIAG] source=" + source.name + " / E列 hit rows=" + hits + " / worker options hit=" + workers.length);
}

function extractTrailingLeaderKana_(value) {
  const text = normalizeWorkerFullName_(value);

  const match = text.match(/([ァ-ヶー]+)$/);

  return match ? normalizeKanaForMatch_(match[1]) : "";
}

function normalizeKanaForMatch_(value) {
  const source = String(value || "");

  const normalized = source.normalize ? source.normalize("NFKC") : source;

  return normalized.replace(/\s+/g, "").replace(/[^ァ-ヶー]/g, "");
}

/**
 * v6.1: 異体字 (old/variant kanji) used in names.
 * NFKC does not unify these (e.g. 瀨 U+7028 vs 瀬 U+702C).
 * Used ONLY for matching; displayed names keep the source characters.
 */
const PERSON_NAME_ITAIJI_MAP_ = {
  瀨: "瀬",
  髙: "高",
  﨑: "崎",
  嵜: "崎",
  邊: "辺",
  邉: "辺",
  齋: "斎",
  齊: "斉",
  濵: "浜",
  濱: "浜",
  澤: "沢",
  櫻: "桜",
  廣: "広",
  國: "国",
  冨: "富",
  德: "徳",
  﨔: "欅",
  槗: "橋",
  塚: "塚",
  籠: "篭",
  舘: "館",
  藪: "薮",
  曻: "昇",
  眞: "真",
};

function normalizeItaijiForMatch_(value) {
  return String(value || "").replace(/[\s\S]/gu, function (ch) {
    return PERSON_NAME_ITAIJI_MAP_[ch] || ch;
  });
}

function normalizePersonNameForReferenceMatch_(value) {
  const source = String(value || "");

  const normalized = source.normalize ? source.normalize("NFKC") : source;

  return normalizeItaijiForMatch_(
    normalized
      .replace(/\u3000/g, "")
      .replace(/\s+/g, "")
      .trim(),
  );
}

function normalizeWorkerFullName_(value) {
  return String(value || "")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Worker display rule:
 * E:F merged cell contains the person's name.
 * Only the surname is displayed in the Web/PDF worker selector/output.
 *
 * Examples:
 *   加茂　雅之      -> 加茂
 *   小深田　浩コフカタヒロシ -> 小深田
 *   佐藤１サトウ    -> 佐藤
 *
 * If the source contains no reliable separator/pattern,
 * preserve the source text rather than guessing a Kanji boundary.
 */
function extractWorkerSurname_(value) {
  const text = normalizeWorkerFullName_(value);

  if (!text) {
    return "";
  }

  /*
   * Normal case: surname + space + given name.
   */
  if (text.indexOf(" ") !== -1) {
    return text.split(" ")[0].trim();
  }

  /*
   * Test/compact source pattern:
   * 佐藤１サトウ
   * 佐藤10サトウ
   *
   * Keep only the leading Kanji surname.
   */
  const compact = text.match(/^([々一-龯﨑髙]+)[0-9０-９]*[ァ-ヶー]+$/);

  if (compact) {
    return compact[1];
  }

  return text;
}

function hasReferenceValue_(value) {
  const text = cleanCellText_(value);

  return Boolean(text && text !== "-" && text !== "ー");
}

function hasQualificationValue_(value) {
  const text = cleanCellText_(value);

  if (!text) {
    return false;
  }

  return text !== "-" && text !== "ー" && text !== "無し" && text !== "なし" && text !== "無" && text !== "0";
}

function getJsonCacheSafe_(cache, key) {
  const cached = cache.get(key);

  if (!cached) {
    return null;
  }

  try {
    return JSON.parse(cached);
  } catch (error) {
    console.log("[WARN] Cache JSON parse failed: " + key);

    return null;
  }
}

function putJsonCacheSmall_(cache, key, value, seconds, label) {
  const json = JSON.stringify(value);

  if (json.length >= 90000) {
    console.log("[WARN] " + label + " cache skipped. size=" + json.length);

    return;
  }

  cache.put(key, json, seconds);
}
