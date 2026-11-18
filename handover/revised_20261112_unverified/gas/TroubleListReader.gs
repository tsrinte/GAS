/**
 * =========================================================
 * TroubleListReader v7 PhoneticFix  (2026-11-12, base = v6 StrictPrimaryCache)
 *
 * v7 changes (only):
 * - sharedStrings / inlineStr의 <rPh>(ふりがな) 텍스트를 셀 값에서 제외.
 *   v6는 <rPh><t>タテヤ</t></rPh>까지 이어붙여 "建屋" → "建屋タテヤ"가 되었고,
 *   그 결과 全棟一覧 header score가 4로 떨어졌다(로컬 시뮬레이션으로 재현).
 * - parsed jobs cache key: TL_JOBS → TL_JOBS_V7 (v6 오염 캐시 재사용 방지)
 *
 * STEP 4A:
 * - Box의 최신 트러블관리리스트(.xlsm/.xlsx)를 자동 선택
 * - Excel을 Google Sheets로 변환하지 않고 OpenXML을 직접 읽음
 * - 평상시 `全棟一覧` worksheet만 직접 파싱하여 로딩 비용 최소화
 * - `全棟一覧`이 존재하면 score와 무관하게 해당 sheet만 사용
 * - `全棟一覧`이 없을 때만 전체 worksheet 자동판별 fallback
 * - 선택된 worksheet에서 section marker(◆...)와 실제 trouble row를 추출
 * - ScriptCache로 동일 최신 파일의 반복 download/parse를 회피
 *
 * Required:
 * - Config.gs              : getRequiredProperty_()
 * - BoxAuth.gs             : getBoxAuthHeader_()
 * - BoxApi.gs              : boxDownloadFile_()
 *
 * Script Property:
 * - BOX_TROUBLE_LIST_FOLDER_ID
 *
 * Excel structure (verified sample):
 * A : section marker / 優先度
 * B : No.
 * E : 建屋
 * F : 装置ID
 * K : 依頼区分
 * L : アラームコード
 * M : アラーム名
 *
 * Alarm-name display rule:
 * - Full-width ASCII English/numbers/symbols -> half-width
 * - Japanese characters remain unchanged
 * =========================================================
 */

const TROUBLE_LIST_CONFIG_ = {
  folderProperty: "BOX_TROUBLE_LIST_FOLDER_ID",

  fileNameRegex: /トラブル管理リスト.*\.(?:xlsm|xlsx)$/i,

  preferredSheetName: "全棟一覧",

  sourceCacheSeconds: 30,

  parsedJobsCacheSeconds: 180,
};

/**
 * Web / backend public API.
 *
 * Returns a compact list for the selector:
 * No. / 装置ID / トラブル名
 */
function getTroubleJobOptions() {
  const source = getLatestTroubleListSource_();

  const rows = getTroubleJobsCached_(source);

  return {
    ok: true,

    sourceFileId: source.id,

    sourceFileName: source.name,

    modifiedAt: source.modifiedAt,

    count: rows.length,

    jobs: rows.map(function (row) {
      return {
        jobKey: row.jobKey,

        no: row.no,

        machineId: row.machineId,

        troubleName: row.troubleName,

        building: row.building,

        requestType: row.requestType,

        alarmCode: row.alarmCode,

        environment: row.environment,

        equipmentModel: row.equipmentModel,
      };
    }),
  };
}

/**
 * Reads the latest file again and resolves one exact job.
 * This prevents Web UI from trusting stale client-side row data.
 */
function getTroubleJobByKey(jobKey) {
  const source = getLatestTroubleListSource_();

  const jobs = getTroubleJobsCached_(source);

  const found = jobs.find(function (row) {
    return String(row.jobKey) === String(jobKey);
  });

  if (!found) {
    throw new Error("선택한 트러블 작업을 최신 리스트에서 찾지 못했습니다. 화면을 새로고침 후 다시 선택하세요.");
  }

  found.sourceFileId = source.id;

  found.sourceFileName = source.name;

  found.sourceModifiedAt = source.modifiedAt;

  return found;
}

/**
 * Parsed Trouble List cache.
 *
 * The list screen and the subsequent job selection normally use
 * the same source file. Without this cache, the same 10~15 second
 * Box download/OpenXML parse happened twice.
 */
function getTroubleJobsCached_(source) {
  const cache = CacheService.getScriptCache();

  const key = ["TL_JOBS_V7", source.id, source.modifiedAt || ""].join(":");

  const cached = cache.get(key);

  if (cached) {
    try {
      const rows = JSON.parse(cached);

      console.log("[TROUBLE CACHE] HIT / jobs=" + rows.length);

      return rows;
    } catch (error) {
      console.log("[WARN] Trouble cache JSON parse failed. Rebuild cache.");
    }
  }

  console.log("[TROUBLE CACHE] MISS");

  const rows = readTroubleJobsFromBoxFile_(source.id, source.name);

  const json = JSON.stringify(rows);

  /*
   * Apps Script Cache entries have a size limit.
   * 35~50 Trouble rows are normally far below this guard.
   */
  if (json.length < 90000) {
    cache.put(key, json, TROUBLE_LIST_CONFIG_.parsedJobsCacheSeconds);
  } else {
    console.log("[WARN] Trouble cache skipped because JSON is too large: " + json.length);
  }

  return rows;
}

/**
 * Clear the cache for the current latest Trouble List.
 * Useful only when debugging.
 */
function clearCurrentTroubleListCache_() {
  const source = getLatestTroubleListSource_(true);

  const cache = CacheService.getScriptCache();

  const key = ["TL_JOBS_V7", source.id, source.modifiedAt || ""].join(":");

  cache.remove(key);

  console.log("[TROUBLE CACHE] CLEARED : " + key);
}

/**
 * Latest trouble-list file in the configured Box folder.
 */
function getLatestTroubleListSource_(forceRefresh) {
  const folderId = getRequiredProperty_(TROUBLE_LIST_CONFIG_.folderProperty);

  const cache = CacheService.getScriptCache();

  const sourceCacheKey = "TL_SOURCE:" + folderId;

  if (!forceRefresh) {
    const cached = cache.get(sourceCacheKey);

    if (cached) {
      try {
        const source = JSON.parse(cached);

        console.log("[TROUBLE SOURCE CACHE] HIT : " + source.name);

        return source;
      } catch (error) {
        console.log("[WARN] Trouble source cache parse failed.");
      }
    }
  }

  const items = listTroubleListFolderFiles_(folderId);

  const candidates = items
    .filter(function (item) {
      return (
        item.type === "file" &&
        TROUBLE_LIST_CONFIG_.fileNameRegex.test(String(item.name || "")) &&
        String(item.name || "").indexOf("~$") !== 0
      );
    })
    .sort(function (a, b) {
      return new Date(b.modified_at || 0).getTime() - new Date(a.modified_at || 0).getTime();
    });

  if (!candidates.length) {
    throw new Error("BOX_TROUBLE_LIST_FOLDER_ID 폴더에서 트러블管理リスト(.xlsm/.xlsx)를 찾지 못했습니다.");
  }

  const latest = candidates[0];

  const source = {
    id: String(latest.id),

    name: latest.name,

    modifiedAt: latest.modified_at || "",
  };

  cache.put(sourceCacheKey, JSON.stringify(source), TROUBLE_LIST_CONFIG_.sourceCacheSeconds);

  return source;
}

function listTroubleListFolderFiles_(folderId) {
  const all = [];

  let offset = 0;

  const limit = 1000;

  while (true) {
    const url =
      "https://api.box.com/2.0/folders/" +
      encodeURIComponent(folderId) +
      "/items?limit=" +
      limit +
      "&offset=" +
      offset +
      "&fields=id,type,name,modified_at,size";

    const response = UrlFetchApp.fetch(url, {
      method: "get",

      headers: getBoxAuthHeader_(),

      muteHttpExceptions: true,
    });

    const status = response.getResponseCode();

    if (status !== 200) {
      throw new Error(["Box Trouble List Folder 조회 실패", "HTTP=" + status, response.getContentText()].join("\n"));
    }

    const json = JSON.parse(response.getContentText());

    const entries = json.entries || [];

    Array.prototype.push.apply(all, entries);

    offset += entries.length;

    if (!entries.length || offset >= Number(json.total_count || 0)) {
      break;
    }
  }

  return all;
}

/**
 * Download Office OpenXML and parse the configured worksheet.
 */
function readTroubleJobsFromBoxFile_(fileId, fileName) {
  const blob = boxDownloadFile_(fileId);

  const entries = unzipOfficeFile_(blob);

  const sharedStrings = parseSharedStrings_(entries);

  const sheets = listWorkbookWorksheets_(entries);

  if (!sheets.length) {
    throw new Error("Workbook에 worksheet가 없습니다.");
  }

  /*
   * ---------------------------------------------------------
   * PRIMARY PATH
   * ---------------------------------------------------------
   * Production first tries the known operational worksheet:
   *   全棟一覧
   *
   * This avoids parsing every worksheet during normal use.
   */
  const preferred = sheets.find(function (sheet) {
    return sheet.name === TROUBLE_LIST_CONFIG_.preferredSheetName;
  });

  if (preferred) {
    const preferredBlob = entries[preferred.path];

    if (!preferredBlob) {
      throw new Error("全棟一覧 worksheet XML을 찾지 못했습니다: " + preferred.path);
    }

    const preferredMatrix = parseWorksheetMatrix_(preferredBlob.getDataAsString("UTF-8"), sharedStrings);

    const preferredScore = scoreTroubleListSheet_(preferredMatrix);

    console.log("[TROUBLE SHEET] PRIMARY=全棟一覧 / score=" + preferredScore);

    /*
     * Production rule:
     * If 全棟一覧 exists, ALWAYS use it.
     *
     * The structural score is diagnostic only.
     * A low score must NOT trigger scanning of every other worksheet,
     * because the operational sheet name is explicitly defined.
     */
    if (preferredScore < 5) {
      console.log("[WARN] 全棟一覧 structure score is low (" + preferredScore + "), but PRIMARY policy keeps using 全棟一覧.");
    }

    return extractTroubleJobsFromMatrix_(preferredMatrix, fileName);
  } else {
    console.log("[WARN] 全棟一覧 worksheet not found. Fallback auto-detect starts.");
  }

  /*
   * ---------------------------------------------------------
   * FALLBACK PATH
   * ---------------------------------------------------------
   * Only used when:
   * - 全棟一覧 does not exist.
   *
   * All worksheets are scored by actual Trouble List structure.
   */
  const candidates = [];

  sheets.forEach(function (sheet) {
    /*
     * If 全棟一覧 was already parsed above, there is no need
     * to parse it again in fallback mode.
     */
    if (preferred && sheet.name === preferred.name) {
      return;
    }

    const sheetBlob = entries[sheet.path];

    if (!sheetBlob) {
      return;
    }

    const matrix = parseWorksheetMatrix_(sheetBlob.getDataAsString("UTF-8"), sharedStrings);

    const score = scoreTroubleListSheet_(matrix);

    candidates.push({
      name: sheet.name,

      path: sheet.path,

      score: score,

      matrix: matrix,
    });
  });

  candidates.sort(function (a, b) {
    return b.score - a.score;
  });

  const selected = candidates[0];

  if (!selected || selected.score < 5) {
    console.log(
      "[TROUBLE SHEET FALLBACK] Candidate list=" +
        JSON.stringify(
          candidates.map(function (item) {
            return {
              name: item.name,

              path: item.path,

              score: item.score,
            };
          }),
        ),
    );

    throw new Error("Trouble List worksheet를 자동 판별하지 못했습니다.");
  }

  console.log("[TROUBLE SHEET FALLBACK] Selected=" + selected.name + " / score=" + selected.score);

  return extractTroubleJobsFromMatrix_(selected.matrix, fileName);
}

/**
 * Enumerate workbook worksheets and resolve each relationship target.
 */
function listWorkbookWorksheets_(entries) {
  const workbook = entries["xl/workbook.xml"];

  const rels = entries["xl/_rels/workbook.xml.rels"];

  if (!workbook || !rels) {
    throw new Error("xl/workbook.xml 또는 workbook.xml.rels가 없습니다.");
  }

  const workbookDoc = XmlService.parse(workbook.getDataAsString("UTF-8"));

  const workbookRoot = workbookDoc.getRootElement();

  const mainNs = workbookRoot.getNamespace();

  const relNs = XmlService.getNamespace("r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships");

  const sheetNodes = workbookRoot.getChild("sheets", mainNs).getChildren("sheet", mainNs);

  const relDoc = XmlService.parse(rels.getDataAsString("UTF-8"));

  const relRoot = relDoc.getRootElement();

  const relMap = {};

  relRoot.getChildren().forEach(function (rel) {
    const idAttr = rel.getAttribute("Id");

    const targetAttr = rel.getAttribute("Target");

    if (idAttr && targetAttr) {
      relMap[idAttr.getValue()] = normalizeWorksheetTargetPath_(targetAttr.getValue());
    }
  });

  return sheetNodes
    .map(function (sheet) {
      const nameAttr = sheet.getAttribute("name");

      const idAttr = sheet.getAttribute("id", relNs);

      const relationId = idAttr ? idAttr.getValue() : "";

      return {
        name: nameAttr ? nameAttr.getValue() : "",

        relationId: relationId,

        path: relMap[relationId] || "",
      };
    })
    .filter(function (sheet) {
      return Boolean(sheet.path);
    });
}

/**
 * Normalize relationship target to the actual ZIP entry path.
 *
 * Common examples:
 * - worksheets/sheet1.xml
 * - /xl/worksheets/sheet1.xml
 * - ../worksheets/sheet1.xml
 */
function normalizeWorksheetTargetPath_(target) {
  let path = normalizeZipPath_(target);

  path = path.replace(/^\/+/, "");

  if (path.indexOf("xl/") === 0) {
    return path;
  }

  while (path.indexOf("../") === 0) {
    path = path.substring(3);
  }

  path = path.replace(/^\.\//, "");

  return "xl/" + path;
}

/**
 * Score how strongly a worksheet looks like the Trouble List.
 *
 * We intentionally inspect cell values instead of sheet names,
 * because revision changes may rename the worksheet.
 */
function scoreTroubleListSheet_(matrix) {
  let score = 0;

  let sectionCount = 0;

  let headerScore = 0;

  const rowNumbers = Object.keys(matrix)
    .map(Number)
    .sort(function (a, b) {
      return a - b;
    });

  rowNumbers.forEach(function (rowNumber) {
    const row = matrix[rowNumber] || {};

    const a = cleanCellText_(row[1]);

    if (a.indexOf("◆") === 0) {
      sectionCount++;
    }

    const b = cleanCellText_(row[2]);

    const e = cleanCellText_(row[5]);

    const f = cleanCellText_(row[6]);

    const k = cleanCellText_(row[11]);

    const m = cleanCellText_(row[13]);

    let rowHeaderScore = 0;

    if (b === "No.") {
      rowHeaderScore++;
    }

    if (e === "建屋") {
      rowHeaderScore++;
    }

    if (f === "装置ID") {
      rowHeaderScore++;
    }

    if (k === "依頼区分") {
      rowHeaderScore++;
    }

    if (m === "アラーム名") {
      rowHeaderScore++;
    }

    headerScore = Math.max(headerScore, rowHeaderScore);
  });

  score += Math.min(sectionCount, 3);

  score += headerScore * 2;

  return score;
}

function unzipOfficeFile_(blob) {
  const zipBlob = blob.copyBlob();

  zipBlob.setContentType("application/zip");

  let parts;

  try {
    parts = Utilities.unzip(zipBlob);
  } catch (error) {
    throw new Error(["Excel OpenXML 압축 해제 실패", error && error.message ? error.message : String(error)].join("\n"));
  }

  const map = {};

  parts.forEach(function (part) {
    map[normalizeZipPath_(part.getName())] = part;
  });

  return map;
}

function normalizeZipPath_(path) {
  return String(path || "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");
}

/**
 * Resolve sheet name -> worksheet XML target.
 */
function parseSharedStrings_(entries) {
  const blob = entries["xl/sharedStrings.xml"];

  if (!blob) {
    return [];
  }

  const doc = XmlService.parse(blob.getDataAsString("UTF-8"));

  const root = doc.getRootElement();

  const ns = root.getNamespace();

  return root.getChildren("si", ns).map(function (si) {
    return collectTextNodes_(si, ns);
  });
}

function collectTextNodes_(element, ns) {
  let result = "";

  /*
   * v7: Excel phonetic guide (ふりがな) is stored in <rPh>.
   * It is NOT part of the displayed cell value.
   */
  const elementName = element.getName();

  if (elementName === "rPh" || elementName === "phoneticPr") {
    return "";
  }

  if (element.getName() === "t") {
    result += element.getText();
  }

  element.getChildren().forEach(function (child) {
    result += collectTextNodes_(child, ns);
  });

  return result;
}

/**
 * Converts worksheet XML into sparse row objects:
 * matrix[rowNumber][columnNumber] = value
 *
 * Column number is 1-based.
 */
function parseWorksheetMatrix_(xml, sharedStrings) {
  const doc = XmlService.parse(xml);

  const root = doc.getRootElement();

  const ns = root.getNamespace();

  const sheetData = root.getChild("sheetData", ns);

  if (!sheetData) {
    return {};
  }

  const matrix = {};

  sheetData.getChildren("row", ns).forEach(function (row) {
    const rowAttr = row.getAttribute("r");

    const rowNumber = rowAttr ? Number(rowAttr.getValue()) : 0;

    if (!rowNumber) {
      return;
    }

    const rowData = {};

    row.getChildren("c", ns).forEach(function (cell) {
      const refAttr = cell.getAttribute("r");

      if (!refAttr) {
        return;
      }

      const ref = refAttr.getValue();

      const columnNumber = columnLettersToNumber_(ref.replace(/\d+/g, ""));

      rowData[columnNumber] = readOpenXmlCellValue_(cell, ns, sharedStrings);
    });

    matrix[rowNumber] = rowData;
  });

  return matrix;
}

function readOpenXmlCellValue_(cell, ns, sharedStrings) {
  const typeAttr = cell.getAttribute("t");

  const type = typeAttr ? typeAttr.getValue() : "";

  if (type === "inlineStr") {
    const isNode = cell.getChild("is", ns);

    return isNode ? collectTextNodes_(isNode, ns) : "";
  }

  const valueNode = cell.getChild("v", ns);

  if (!valueNode) {
    return "";
  }

  const raw = valueNode.getText();

  if (type === "s") {
    const index = Number(raw);

    return sharedStrings[index] !== undefined ? sharedStrings[index] : "";
  }

  if (type === "b") {
    return raw === "1";
  }

  return raw;
}

function columnLettersToNumber_(letters) {
  let result = 0;

  String(letters || "")
    .toUpperCase()
    .split("")
    .forEach(function (ch) {
      result = result * 26 + (ch.charCodeAt(0) - 64);
    });

  return result;
}

/**
 * Trouble List business parsing.
 */
function extractTroubleJobsFromMatrix_(matrix, fileName) {
  const jobs = [];

  let categoryRaw = "";

  const rowNumbers = Object.keys(matrix)
    .map(Number)
    .sort(function (a, b) {
      return a - b;
    });

  rowNumbers.forEach(function (rowNumber) {
    const row = matrix[rowNumber] || {};

    const colA = cleanCellText_(row[1]);

    if (colA.indexOf("◆") === 0) {
      categoryRaw = colA;

      return;
    }

    const no = cleanCellText_(row[2]);

    const machineId = cleanCellText_(row[6]);

    const troubleNameRaw = cleanCellText_(row[13]);

    const troubleName = normalizeTroubleDisplayText_(troubleNameRaw);

    /*
     * Header / blank row / irrelevant row.
     */
    if (!no || no === "No." || !machineId || !troubleName) {
      return;
    }

    const classification = classifyTroubleMachine_(categoryRaw, machineId);

    jobs.push({
      jobKey: buildTroubleJobKey_(no, machineId, rowNumber),

      rowNumber: rowNumber,

      no: no,

      priority: cleanCellText_(row[1]),

      building: cleanCellText_(row[5]),

      machineId: machineId,

      stopChannel: cleanCellText_(row[7]),

      requestType: cleanCellText_(row[11]),

      alarmCode: cleanCellText_(row[12]),

      troubleName: troubleName,

      troubleNameRaw: troubleNameRaw,

      categoryRaw: categoryRaw,

      environment: classification.environment,

      equipmentModel: classification.equipmentModel,

      classificationStatus: classification.status,

      sourceFileName: fileName,
    });
  });

  return jobs;
}

function classifyTroubleMachine_(categoryRaw, machineId) {
  const category = String(categoryRaw || "");

  const machine = String(machineId || "").toUpperCase();

  if (category.indexOf("F-REX300E") !== -1 || category.indexOf("EAC300BI-HV") !== -1) {
    if (machine.indexOf("OBE") === 0) {
      return {
        environment: "BEVEL",

        equipmentModel: "EAC300bi-hv",

        status: "VERIFIED_RULE",
      };
    }

    if (machine.indexOf("OFX") === 0) {
      return {
        environment: "300E",

        equipmentModel: "F-REX300E",

        status: "VERIFIED_RULE",
      };
    }
  }

  if (category.indexOf("F-REX300X") !== -1 && machine.indexOf("OFX") === 0) {
    return {
      environment: "300X",

      equipmentModel: "F-REX300X",

      status: "VERIFIED_RULE",
    };
  }

  return {
    environment: "OTHER",

    equipmentModel: "",

    status: "REQUIRES_CONFIRMATION",
  };
}

function buildTroubleJobKey_(no, machineId, rowNumber) {
  return [String(no), String(machineId), String(rowNumber)].join("|");
}

/**
 * Trouble-name display normalization.
 *
 * Goal:
 * - Full-width ASCII letters/digits/symbols -> half-width ASCII
 * - U+3000 full-width space -> normal space
 * - Japanese kana/kanji/middle-dot `・` remain unchanged
 *
 * Example:
 *   ＰＯＬＩ１・ステージ真空吸着タイムアウト
 *   -> POLI1・ステージ真空吸着タイムアウト
 *
 * Important:
 * This is NOT the device/trouble separator rule.
 * Document workTitle still joins:
 *   shortMachineId + single SPACE + normalized troubleName
 */
function normalizeTroubleDisplayText_(value) {
  return String(value || "")
    .replace(/[\uFF01-\uFF5E]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
    })
    .replace(/\u3000/g, " ")
    .trim();
}

function cleanCellText_(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/\u00A0/g, " ")
    .trim();
}
