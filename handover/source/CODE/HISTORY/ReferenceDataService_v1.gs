/**
 * =========================================================
 * ReferenceDataService v1
 *
 * STEP 4B:
 * Trouble List BASE_JOB_DATA에 다음 Master를 연결한다.
 *
 * 1) Info2026
 *    - 装置情報
 *      A = 装置ID
 *      B = 製造番号(serialNo)
 *      E = 作業報告用客先名(customerName)
 *      F = 作業場所(workLocation)
 *      G = 旧制番(oldSerial)
 *
 *    - 職長_PHS
 *      A = 職長
 *      B = PHS
 *      C = 300X
 *      D = 300E
 *      E = Bevel
 *
 * 2) Worker Master
 *    - 作業者名簿台帳装置
 *    - name row      : r = 22,24,...,198 / E[r]
 *    - qualification: r-1 / I:J:K:L
 *      I = ガス
 *      J = 電気
 *      K = 職長
 *      L = 安衛法60条
 *    - hidden name row is excluded
 *
 * Script Properties:
 * - BOX_INFO2026_FILE_ID
 * - BOX_WORKER_MASTER_FOLDER_ID
 *
 * Requires:
 * - TroubleListReader v6 helpers:
 *   unzipOfficeFile_()
 *   parseSharedStrings_()
 *   listWorkbookWorksheets_()
 *   parseWorksheetMatrix_()
 *   cleanCellText_()
 *   listTroubleListFolderFiles_()
 * - JobDataService v2:
 *   loadBaseJobData()
 * =========================================================
 */


const REFERENCE_DATA_CONFIG_ =
  {
    infoFileProperty:
      'BOX_INFO2026_FILE_ID',

    workerFolderProperty:
      'BOX_WORKER_MASTER_FOLDER_ID',

    workerFileNameRegex:
      /安全管理体制図.*\.(?:xlsx|xlsm)$/i,

    infoDeviceSheet:
      '装置情報',

    infoLeaderSheet:
      '職長_PHS',

    workerSheet:
      '作業者名簿台帳装置',

    infoCacheSeconds:
      600,

    workerCacheSeconds:
      300
  };


/**
 * Web/backend public API.
 *
 * Returns:
 * - JOB_DATA draft enriched with equipment info
 * - leader options eligible for job environment
 * - visible worker options with qualifications
 */
function getReferenceDataForJob(
  jobKey
) {

  const base =
    loadBaseJobData(
      jobKey
    );


  const info =
    getInfo2026ReferenceCached_();


  const deviceResult =
    findDeviceInfo_(
      info.devices,
      base.machineId
    );


  const leaderOptions =
    filterLeaderOptions_(
      info.leaders,
      base.environment
    );


  const workerMaster =
    getWorkerMasterCached_();


  const warnings =
    []
      .concat(
        base.warnings
        ||
        []
      );


  if (!deviceResult.found) {

    warnings.push(
      'Info2026 装置情報에서 装置ID '
      +
      base.machineId
      +
      ' 를 찾지 못했습니다.'
    );
  }


  if (!leaderOptions.length) {

    warnings.push(
      '환경 '
      +
      base.environment
      +
      ' 에 대응 가능한 職長候補를 찾지 못했습니다.'
    );
  }


  if (
    !workerMaster.workers.length
  ) {

    warnings.push(
      'Worker Master에서 유효한 작업자를 찾지 못했습니다.'
    );
  }


  const jobData =
    Object.assign(
      {},
      base,
      {
        dataState:
          'JOB_DATA_READY',

        customerName:
          deviceResult.record
            ? deviceResult.record.customerName
            : '',

        workLocation:
          deviceResult.record
            ? deviceResult.record.workLocation
            : '',

        serialNo:
          deviceResult.record
            ? deviceResult.record.serialNo
            : '',

        oldSerial:
          deviceResult.record
            ? deviceResult.record.oldSerial
            : '',

        warnings:
          warnings
      }
    );


  return {
    ok:
      true,

    dataState:
      'JOB_DATA_READY',

    jobData:
      jobData,

    reference:
      {
        info2026:
          {
            fileId:
              info.fileId,

            deviceCount:
              info.devices.length,

            leaderCount:
              info.leaders.length
          },

        workerMaster:
          {
            fileId:
              workerMaster.fileId,

            fileName:
              workerMaster.fileName,

            modifiedAt:
              workerMaster.modifiedAt,

            workerCount:
              workerMaster.workers.length
          }
      },

    leaderOptions:
      leaderOptions,

    workerOptions:
      workerMaster.workers
  };
}


/**
 * ---------------------------------------------------------
 * Info2026
 * ---------------------------------------------------------
 */

function getInfo2026ReferenceCached_() {

  const fileId =
    getRequiredProperty_(
      REFERENCE_DATA_CONFIG_
        .infoFileProperty
    );


  const cache =
    CacheService.getScriptCache();


  const key =
    'INFO2026:'
    +
    fileId;


  const cached =
    cache.get(
      key
    );


  if (cached) {

    try {

      const parsed =
        JSON.parse(
          cached
        );


      console.log(
        '[INFO2026 CACHE] HIT'
      );


      return parsed;
    }

    catch (error) {

      console.log(
        '[WARN] INFO2026 cache parse failed.'
      );
    }
  }


  console.log(
    '[INFO2026 CACHE] MISS'
  );


  const blob =
    boxDownloadFile_(
      fileId
    );


  const entries =
    unzipOfficeFile_(
      blob
    );


  const sharedStrings =
    parseSharedStrings_(
      entries
    );


  const deviceMatrix =
    getWorkbookSheetMatrixByName_(
      entries,
      sharedStrings,
      REFERENCE_DATA_CONFIG_
        .infoDeviceSheet
    );


  const leaderMatrix =
    getWorkbookSheetMatrixByName_(
      entries,
      sharedStrings,
      REFERENCE_DATA_CONFIG_
        .infoLeaderSheet
    );


  const result =
    {
      fileId:
        String(
          fileId
        ),

      devices:
        extractInfo2026Devices_(
          deviceMatrix
        ),

      leaders:
        extractInfo2026Leaders_(
          leaderMatrix
        )
    };


  putJsonCacheIfSmall_(
    cache,
    key,
    result,
    REFERENCE_DATA_CONFIG_
      .infoCacheSeconds,
    'INFO2026'
  );


  return result;
}


function extractInfo2026Devices_(
  matrix
) {

  const records =
    [];


  Object.keys(
    matrix
  )
    .map(
      Number
    )
    .sort(
      function(a, b) {

        return a
          -
          b;
      }
    )
    .forEach(
      function(rowNumber) {

        if (
          rowNumber
          <=
          1
        ) {

          return;
        }


        const row =
          matrix[
            rowNumber
          ]
          ||
          {};


        const machineId =
          cleanCellText_(
            row[
              1
            ]
          );


        if (!machineId) {

          return;
        }


        records.push(
          {
            rowNumber:
              rowNumber,

            machineId:
              machineId,

            serialNo:
              cleanCellText_(
                row[
                  2
                ]
              ),

            customerName:
              normalizeReferenceDisplayText_(
                row[
                  5
                ]
              ),

            workLocation:
              normalizeReferenceDisplayText_(
                row[
                  6
                ]
              ),

            oldSerial:
              cleanCellText_(
                row[
                  7
                ]
              )
          }
        );
      }
    );


  return records;
}


function extractInfo2026Leaders_(
  matrix
) {

  const records =
    [];


  Object.keys(
    matrix
  )
    .map(
      Number
    )
    .sort(
      function(a, b) {

        return a
          -
          b;
      }
    )
    .forEach(
      function(rowNumber) {

        if (
          rowNumber
          <=
          1
        ) {

          return;
        }


        const row =
          matrix[
            rowNumber
          ]
          ||
          {};


        const name =
          normalizeReferenceDisplayText_(
            row[
              1
            ]
          );


        if (!name) {

          return;
        }


        records.push(
          {
            leaderKey:
              [
                name,
                rowNumber
              ]
                .join(
                  '|'
                ),

            rowNumber:
              rowNumber,

            name:
              name,

            phs:
              cleanCellText_(
                row[
                  2
                ]
              )
              ||
              '-',

            eligibility:
              {
                '300X':
                  hasReferenceValue_(
                    row[
                      3
                    ]
                  ),

                '300E':
                  hasReferenceValue_(
                    row[
                      4
                    ]
                  ),

                'BEVEL':
                  hasReferenceValue_(
                    row[
                      5
                    ]
                  )
              }
          }
        );
      }
    );


  return records;
}


function filterLeaderOptions_(
  leaders,
  environment
) {

  const env =
    String(
      environment
      ||
      ''
    )
      .toUpperCase();


  return leaders
    .filter(
      function(leader) {

        if (
          env
          ===
          'BEVEL'
        ) {

          return Boolean(
            leader.eligibility.BEVEL
          );
        }


        if (
          env
          ===
          '300X'
          ||
          env
          ===
          '300E'
        ) {

          return Boolean(
            leader.eligibility[
              env
            ]
          );
        }


        /*
         * OTHER cannot be auto-filtered safely.
         * Return all leaders and let Web UI ask for confirmation.
         */
        return true;
      }
    )
    .map(
      function(leader) {

        return {
          leaderKey:
            leader.leaderKey,

          name:
            leader.name,

          phs:
            leader.phs,

          eligibility:
            leader.eligibility
        };
      }
    );
}


/**
 * ---------------------------------------------------------
 * Worker Master
 * ---------------------------------------------------------
 */

function getWorkerMasterCached_() {

  const source =
    getLatestWorkerMasterSource_();


  const cache =
    CacheService.getScriptCache();


  const key =
    [
      'WORKER_MASTER',
      source.id,
      source.modifiedAt
      ||
      ''
    ]
      .join(
        ':'
      );


  const cached =
    cache.get(
      key
    );


  if (cached) {

    try {

      const parsed =
        JSON.parse(
          cached
        );


      console.log(
        '[WORKER CACHE] HIT / workers='
        +
        parsed.workers.length
      );


      return parsed;
    }

    catch (error) {

      console.log(
        '[WARN] Worker cache parse failed.'
      );
    }
  }


  console.log(
    '[WORKER CACHE] MISS'
  );


  const blob =
    boxDownloadFile_(
      source.id
    );


  const entries =
    unzipOfficeFile_(
      blob
    );


  const sharedStrings =
    parseSharedStrings_(
      entries
    );


  const sheet =
    getWorkbookSheetEntryByName_(
      entries,
      REFERENCE_DATA_CONFIG_
        .workerSheet
    );


  const sheetBlob =
    entries[
      sheet.path
    ];


  const xml =
    sheetBlob.getDataAsString(
      'UTF-8'
    );


  const matrix =
    parseWorksheetMatrix_(
      xml,
      sharedStrings
    );


  const hiddenRows =
    parseHiddenWorksheetRows_(
      xml
    );


  const result =
    {
      fileId:
        source.id,

      fileName:
        source.name,

      modifiedAt:
        source.modifiedAt,

      workers:
        extractWorkerOptions_(
          matrix,
          hiddenRows
        )
    };


  putJsonCacheIfSmall_(
    cache,
    key,
    result,
    REFERENCE_DATA_CONFIG_
      .workerCacheSeconds,
    'WORKER_MASTER'
  );


  return result;
}


function getLatestWorkerMasterSource_() {

  const folderId =
    getRequiredProperty_(
      REFERENCE_DATA_CONFIG_
        .workerFolderProperty
    );


  const items =
    listTroubleListFolderFiles_(
      folderId
    );


  const regex =
    REFERENCE_DATA_CONFIG_
      .workerFileNameRegex;


  const candidates =
    items
      .filter(
        function(item) {

          /*
           * Reset global-regex state defensively if regex is changed later.
           */
          regex.lastIndex =
            0;


          return (
            item.type
            ===
            'file'
            &&
            regex.test(
              String(
                item.name
                ||
                ''
              )
            )
          );
        }
      )
      .sort(
        function(a, b) {

          return (
            new Date(
              b.modified_at
              ||
              0
            )
              .getTime()
            -
            new Date(
              a.modified_at
              ||
              0
            )
              .getTime()
          );
        }
      );


  if (!candidates.length) {

    throw new Error(
      'BOX_WORKER_MASTER_FOLDER_ID에서 안전管理体制図 Master를 찾지 못했습니다.'
    );
  }


  const latest =
    candidates[
      0
    ];


  return {
    id:
      String(
        latest.id
      ),

    name:
      latest.name,

    modifiedAt:
      latest.modified_at
      ||
      ''
  };
}


function extractWorkerOptions_(
  matrix,
  hiddenRows
) {

  const workers =
    [];


  /*
   * Verified Worker Master structure:
   * qualification row = r-1
   * name row          = r
   */
  for (
    let r =
      22;
    r
    <=
    198;
    r +=
      2
  ) {

    if (
      hiddenRows[
        r
      ]
    ) {

      continue;
    }


    const nameRow =
      matrix[
        r
      ]
      ||
      {};


    const qualificationRow =
      matrix[
        r
        -
        1
      ]
      ||
      {};


    const rawName =
      cleanCellText_(
        nameRow[
          5
        ]
      );


    if (!rawName) {

      continue;
    }


    const displayName =
      normalizeWorkerDisplayName_(
        rawName
      );


    workers.push(
      {
        workerKey:
          [
            displayName,
            r
          ]
            .join(
              '|'
            ),

        name:
          displayName,

        nameRaw:
          rawName,

        /*
         * Worker PHS source is not defined in this Master.
         * Current business rule: unresolved worker PHS = "-"
         */
        phs:
          '-',

        qualifications:
          {
            gas:
              hasQualificationValue_(
                qualificationRow[
                  9
                ]
              ),

            electric:
              hasQualificationValue_(
                qualificationRow[
                  10
                ]
              ),

            leader:
              hasQualificationValue_(
                qualificationRow[
                  11
                ]
              ),

            law60:
              hasQualificationValue_(
                qualificationRow[
                  12
                ]
              )
          },

        sourceNameRow:
          r,

        sourceQualificationRow:
          r
          -
          1,

        attendanceCell:
          'B'
          +
          (
            r
            -
            1
          )
      }
    );
  }


  return workers;
}


/**
 * ---------------------------------------------------------
 * Shared helpers
 * ---------------------------------------------------------
 */

function getWorkbookSheetEntryByName_(
  entries,
  sheetName
) {

  const sheets =
    listWorkbookWorksheets_(
      entries
    );


  const found =
    sheets.find(
      function(sheet) {

        return (
          sheet.name
          ===
          sheetName
        );
      }
    );


  if (!found) {

    throw new Error(
      'Workbook sheet를 찾지 못했습니다: '
      +
      sheetName
    );
  }


  if (
    !entries[
      found.path
    ]
  ) {

    throw new Error(
      'Worksheet XML을 찾지 못했습니다: '
      +
      found.path
    );
  }


  return found;
}


function getWorkbookSheetMatrixByName_(
  entries,
  sharedStrings,
  sheetName
) {

  const sheet =
    getWorkbookSheetEntryByName_(
      entries,
      sheetName
    );


  return parseWorksheetMatrix_(
    entries[
      sheet.path
    ]
      .getDataAsString(
        'UTF-8'
      ),
    sharedStrings
  );
}


function parseHiddenWorksheetRows_(
  xml
) {

  const hidden =
    {};


  const doc =
    XmlService.parse(
      xml
    );


  const root =
    doc.getRootElement();


  const ns =
    root.getNamespace();


  const sheetData =
    root.getChild(
      'sheetData',
      ns
    );


  if (!sheetData) {

    return hidden;
  }


  sheetData
    .getChildren(
      'row',
      ns
    )
    .forEach(
      function(row) {

        const rowAttr =
          row.getAttribute(
            'r'
          );


        const hiddenAttr =
          row.getAttribute(
            'hidden'
          );


        if (
          rowAttr
          &&
          hiddenAttr
          &&
          hiddenAttr.getValue()
          ===
          '1'
        ) {

          hidden[
            Number(
              rowAttr.getValue()
            )
          ] =
            true;
        }
      }
    );


  return hidden;
}


function normalizeReferenceDisplayText_(
  value
) {

  return normalizeTroubleDisplayText_(
    cleanCellText_(
      value
    )
  )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}


function normalizeWorkerDisplayName_(
  value
) {

  let text =
    String(
      value
      ||
      ''
    )
      .replace(
        /\u3000/g,
        ' '
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();


  /*
   * Some source cells contain:
   *   小深田 浩コフカタヒロシ
   *
   * When a CJK name is followed by a Katakana reading,
   * remove only the trailing reading.
   *
   * Katakana-only legitimate names are not changed because
   * this rule requires a CJK character before the suffix.
   */
  const match =
    text.match(
      /^(.*[一-龯々])([ァ-ヶー][ァ-ヶー・\s]*)$/
    );


  if (
    match
  ) {

    text =
      match[
        1
      ]
        .trim();
  }


  return text;
}


function hasReferenceValue_(
  value
) {

  const text =
    cleanCellText_(
      value
    );


  return Boolean(
    text
    &&
    text
    !==
    '-'
    &&
    text
    !==
    'ー'
  );
}


function hasQualificationValue_(
  value
) {

  const text =
    cleanCellText_(
      value
    );


  if (!text) {

    return false;
  }


  return (
    text
    !==
    '-'
    &&
    text
    !==
    'ー'
    &&
    text
    !==
    '無し'
    &&
    text
    !==
    'なし'
    &&
    text
    !==
    '無'
    &&
    text
    !==
    '0'
  );
}


function findDeviceInfo_(
  devices,
  machineId
) {

  const target =
    String(
      machineId
      ||
      ''
    )
      .trim()
      .toUpperCase();


  const matches =
    devices.filter(
      function(device) {

        return (
          String(
            device.machineId
            ||
            ''
          )
            .trim()
            .toUpperCase()
          ===
          target
        );
      }
    );


  return {
    found:
      Boolean(
        matches.length
      ),

    duplicateCount:
      Math.max(
        0,
        matches.length
        -
        1
      ),

    record:
      matches.length
        ? matches[
            0
          ]
        : null
  };
}


function putJsonCacheIfSmall_(
  cache,
  key,
  value,
  seconds,
  label
) {

  const json =
    JSON.stringify(
      value
    );


  if (
    json.length
    <
    90000
  ) {

    cache.put(
      key,
      json,
      seconds
    );
  }

  else {

    console.log(
      '[WARN] '
      +
      label
      +
      ' cache skipped. size='
      +
      json.length
    );
  }
}
