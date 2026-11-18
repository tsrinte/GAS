/**
 * =========================================================
 * ReferenceDataService v4 Leader Normalize
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

    deviceCacheSeconds:
      3600,

    leaderCacheSeconds:
      600,

    workerCacheSeconds:
      300,

    workerSourceCacheSeconds:
      60
  };


/**
 * Web/backend public API.
 */
function getReferenceDataForJob(
  jobKey
) {

  const startedAt =
    Date.now();


  const base =
    loadBaseJobData(
      jobKey
    );


  console.log(
    '[REF FAST] BASE_JOB_DATA ready / ms='
    +
    (
      Date.now()
      -
      startedAt
    )
  );


  const infoStartedAt =
    Date.now();


  const info =
    getInfo2026ForMachineFast_(
      base.machineId
    );


  console.log(
    '[REF FAST] INFO2026 ready / ms='
    +
    (
      Date.now()
      -
      infoStartedAt
    )
  );


  const rawLeaderOptions =
    filterLeaderOptions_(
      info.leaders,
      base.environment
    );


  const workerStartedAt =
    Date.now();


  const workerMaster =
    getWorkerMasterFastCached_();


  console.log(
    '[REF FAST] WORKER MASTER ready / ms='
    +
    (
      Date.now()
      -
      workerStartedAt
    )
  );


  const leaderOptions =
    attachLeaderWorkerMasterData_(
      rawLeaderOptions,
      workerMaster.workers
    );


  const warnings =
    []
      .concat(
        base.warnings
        ||
        []
      );


  if (
    !info.device.found
  ) {

    warnings.push(
      'Info2026 装置情報에서 装置ID '
      +
      base.machineId
      +
      ' 를 찾지 못했습니다.'
    );
  }


  if (
    !leaderOptions.length
  ) {

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


  const record =
    info.device.record;


  const jobData =
    Object.assign(
      {},
      base,
      {
        dataState:
          'JOB_DATA_READY',

        customerName:
          record
            ? record.customerName
            : '',

        workLocation:
          record
            ? record.workLocation
            : '',

        serialNo:
          record
            ? record.serialNo
            : '',

        oldSerial:
          record
            ? record.oldSerial
            : '',

        warnings:
          warnings
      }
    );


  console.log(
    '[REF FAST] TOTAL / ms='
    +
    (
      Date.now()
      -
      startedAt
    )
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

            deviceFound:
              info.device.found,

            deviceMatchCount:
              info.device.matchCount,

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
function getInfo2026ForMachineFast_(
  machineId
) {

  const fileId =
    getRequiredProperty_(
      REFERENCE_DATA_CONFIG_
        .infoFileProperty
    );


  const cache =
    CacheService.getScriptCache();


  const normalizedMachineId =
    String(
      machineId
      ||
      ''
    )
      .trim()
      .toUpperCase();


  const deviceKey =
    'INFO_DEVICE_V2:'
    +
    fileId
    +
    ':'
    +
    normalizedMachineId;


  const leaderKey =
    'INFO_LEADERS_V2:'
    +
    fileId;


  const cachedDevice =
    getJsonCacheSafe_(
      cache,
      deviceKey
    );


  const cachedLeaders =
    getJsonCacheSafe_(
      cache,
      leaderKey
    );


  if (
    cachedDevice
    &&
    cachedLeaders
  ) {

    console.log(
      '[INFO2026 FAST CACHE] HIT / device + leaders'
    );


    return {
      fileId:
        String(
          fileId
        ),

      device:
        cachedDevice,

      leaders:
        cachedLeaders
    };
  }


  console.log(
    '[INFO2026 FAST CACHE] MISS'
  );


  const downloadStartedAt =
    Date.now();


  const blob =
    boxDownloadFile_(
      fileId
    );


  const entries =
    unzipOfficeFile_(
      blob
    );


  console.log(
    '[INFO2026 FAST] download+unzip / ms='
    +
    (
      Date.now()
      -
      downloadStartedAt
    )
  );


  /*
   * Small workbook.xml + rels only.
   * This does NOT parse all worksheet contents.
   */
  const deviceSheet =
    getWorkbookSheetEntryByNameFast_(
      entries,
      REFERENCE_DATA_CONFIG_
        .infoDeviceSheet
    );


  const leaderSheet =
    getWorkbookSheetEntryByNameFast_(
      entries,
      REFERENCE_DATA_CONFIG_
        .infoLeaderSheet
    );


  /*
   * sharedStrings.xml is workbook-global, but we parse it with
   * a lightweight string parser instead of XmlService.
   */
  const sharedStartedAt =
    Date.now();


  const sharedStrings =
    parseSharedStringsFast_(
      entries
    );


  console.log(
    '[INFO2026 FAST] sharedStrings / count='
    +
    sharedStrings.length
    +
    ' / ms='
    +
    (
      Date.now()
      -
      sharedStartedAt
    )
  );


  let device =
    cachedDevice;


  if (!device) {

    const deviceStartedAt =
      Date.now();


    device =
      findInfo2026DeviceFast_(
        entries[
          deviceSheet.path
        ]
          .getDataAsString(
            'UTF-8'
          ),
        sharedStrings,
        normalizedMachineId
      );


    console.log(
      '[INFO2026 FAST] 装置情報 lookup / found='
      +
      device.found
      +
      ' / ms='
      +
      (
        Date.now()
        -
        deviceStartedAt
      )
    );


    putJsonCacheSmall_(
      cache,
      deviceKey,
      device,
      REFERENCE_DATA_CONFIG_
        .deviceCacheSeconds,
      'INFO_DEVICE'
    );
  }


  let leaders =
    cachedLeaders;


  if (!leaders) {

    const leaderStartedAt =
      Date.now();


    leaders =
      extractInfo2026LeadersFast_(
        entries[
          leaderSheet.path
        ]
          .getDataAsString(
            'UTF-8'
          ),
        sharedStrings
      );


    console.log(
      '[INFO2026 FAST] 職長_PHS / count='
      +
      leaders.length
      +
      ' / ms='
      +
      (
        Date.now()
        -
        leaderStartedAt
      )
    );


    putJsonCacheSmall_(
      cache,
      leaderKey,
      leaders,
      REFERENCE_DATA_CONFIG_
        .leaderCacheSeconds,
      'INFO_LEADERS'
    );
  }


  return {
    fileId:
      String(
        fileId
      ),

    device:
      device,

    leaders:
      leaders
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
function findInfo2026DeviceFast_(
  xml,
  sharedStrings,
  targetMachineId
) {

  const wantedColumns =
    {
      A:
        true,

      B:
        true,

      E:
        true,

      F:
        true,

      G:
        true
    };


  const rowRegex =
    /<row\b([^>]*)>([\s\S]*?)<\/row>/g;


  let rowMatch;


  let matchCount =
    0;


  let firstRecord =
    null;


  while (
    (
      rowMatch =
        rowRegex.exec(
          xml
        )
    )
    !==
    null
  ) {

    const attrs =
      rowMatch[
        1
      ];


    const rowNumberMatch =
      attrs.match(
        /\br="(\d+)"/
      );


    const rowNumber =
      rowNumberMatch
        ? Number(
            rowNumberMatch[
              1
            ]
          )
        : 0;


    if (
      rowNumber
      <=
      1
    ) {

      continue;
    }


    const cells =
      readSelectedCellsFast_(
        rowMatch[
          2
        ],
        wantedColumns,
        sharedStrings
      );


    const machineId =
      cleanCellText_(
        cells.A
      )
        .toUpperCase();


    if (
      !machineId
      ||
      machineId
      !==
      targetMachineId
    ) {

      continue;
    }


    matchCount++;


    if (!firstRecord) {

      firstRecord =
        {
          rowNumber:
            rowNumber,

          machineId:
            cleanCellText_(
              cells.A
            ),

          serialNo:
            cleanCellText_(
              cells.B
            ),

          customerName:
            normalizeReferenceDisplayText_(
              cells.E
            ),

          workLocation:
            normalizeReferenceDisplayText_(
              cells.F
            ),

          oldSerial:
            cleanCellText_(
              cells.G
            )
        };
    }


    /*
     * Machine ID should be unique.
     * For speed we return after the first exact match.
     */
    break;
  }


  return {
    found:
      Boolean(
        firstRecord
      ),

    matchCount:
      matchCount,

    record:
      firstRecord
  };
}


/**
 * 職長_PHS:
 * Only A:E.
 */
function extractInfo2026LeadersFast_(
  xml,
  sharedStrings
) {

  const leaders =
    [];


  const wantedColumns =
    {
      A:
        true,

      B:
        true,

      C:
        true,

      D:
        true,

      E:
        true
    };


  const rowRegex =
    /<row\b([^>]*)>([\s\S]*?)<\/row>/g;


  let rowMatch;


  while (
    (
      rowMatch =
        rowRegex.exec(
          xml
        )
    )
    !==
    null
  ) {

    const attrs =
      rowMatch[
        1
      ];


    const rowNumberMatch =
      attrs.match(
        /\br="(\d+)"/
      );


    const rowNumber =
      rowNumberMatch
        ? Number(
            rowNumberMatch[
              1
            ]
          )
        : 0;


    if (
      rowNumber
      <=
      1
    ) {

      continue;
    }


    const cells =
      readSelectedCellsFast_(
        rowMatch[
          2
        ],
        wantedColumns,
        sharedStrings
      );


    const nameRaw =
      normalizeReferenceDisplayText_(
        cells.A
      );


    const name =
      extractLeaderDisplayName_(
        nameRaw
      );


    if (!name) {

      continue;
    }


    leaders.push(
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

        nameRaw:
          nameRaw,

        phs:
          cleanCellText_(
            cells.B
          )
          ||
          '-',

        eligibility:
          {
            '300X':
              hasReferenceValue_(
                cells.C
              ),

            '300E':
              hasReferenceValue_(
                cells.D
              ),

            'BEVEL':
              hasReferenceValue_(
                cells.E
              )
          }
      }
    );
  }


  return leaders;
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

          nameRaw:
            leader.nameRaw
            ||
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

  const source =
    getLatestWorkerMasterSourceCached_();


  const cache =
    CacheService.getScriptCache();


  const key =
    [
      'WORKER_FAST',
      source.id,
      source.modifiedAt
      ||
      ''
    ]
      .join(
        ':'
      );


  const cached =
    getJsonCacheSafe_(
      cache,
      key
    );


  if (cached) {

    console.log(
      '[WORKER FAST CACHE] HIT / workers='
      +
      cached.workers.length
    );


    return cached;
  }


  console.log(
    '[WORKER FAST CACHE] MISS'
  );


  const downloadStartedAt =
    Date.now();


  const blob =
    boxDownloadFile_(
      source.id
    );


  const entries =
    unzipOfficeFile_(
      blob
    );


  console.log(
    '[WORKER FAST] download+unzip / ms='
    +
    (
      Date.now()
      -
      downloadStartedAt
    )
  );


  const sheet =
    getWorkbookSheetEntryByNameFast_(
      entries,
      REFERENCE_DATA_CONFIG_
        .workerSheet
    );


  const sharedStrings =
    parseSharedStringsFast_(
      entries
    );


  const xml =
    entries[
      sheet.path
    ]
      .getDataAsString(
        'UTF-8'
      );


  const workers =
    extractWorkerOptionsFast_(
      xml,
      sharedStrings
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
        workers
    };


  putJsonCacheSmall_(
    cache,
    key,
    result,
    REFERENCE_DATA_CONFIG_
      .workerCacheSeconds,
    'WORKER_FAST'
  );


  return result;
}


function getLatestWorkerMasterSourceCached_() {

  const folderId =
    getRequiredProperty_(
      REFERENCE_DATA_CONFIG_
        .workerFolderProperty
    );


  const cache =
    CacheService.getScriptCache();


  const key =
    'WORKER_SOURCE:'
    +
    folderId;


  const cached =
    getJsonCacheSafe_(
      cache,
      key
    );


  if (cached) {

    return cached;
  }


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


  const source =
    {
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


  putJsonCacheSmall_(
    cache,
    key,
    source,
    REFERENCE_DATA_CONFIG_
      .workerSourceCacheSeconds,
    'WORKER_SOURCE'
  );


  return source;
}


function extractWorkerOptionsFast_(
  xml,
  sharedStrings
) {

  const rows =
    {};


  const rowRegex =
    /<row\b([^>]*)>([\s\S]*?)<\/row>/g;


  let rowMatch;


  while (
    (
      rowMatch =
        rowRegex.exec(
          xml
        )
    )
    !==
    null
  ) {

    const attrs =
      rowMatch[
        1
      ];


    const rowNumberMatch =
      attrs.match(
        /\br="(\d+)"/
      );


    if (!rowNumberMatch) {

      continue;
    }


    const rowNumber =
      Number(
        rowNumberMatch[
          1
        ]
      );


    if (
      rowNumber
      <
      21
      ||
      rowNumber
      >
      198
    ) {

      continue;
    }


    const hidden =
      /\bhidden="1"/.test(
        attrs
      );


    rows[
      rowNumber
    ] =
      {
        hidden:
          hidden,

        cells:
          readSelectedCellsFast_(
            rowMatch[
              2
            ],
            {
              E:
                true,

              I:
                true,

              J:
                true,

              K:
                true,

              L:
                true
            },
            sharedStrings
          )
      };
  }


  const workers =
    [];


  for (
    let r =
      22;
    r
    <=
    198;
    r +=
      2
  ) {

    const nameRow =
      rows[
        r
      ];


    if (
      !nameRow
      ||
      nameRow.hidden
    ) {

      continue;
    }


    const qualificationRow =
      rows[
        r
        -
        1
      ]
      ||
      {
        cells:
          {}
      };


    const rawName =
      cleanCellText_(
        nameRow.cells.E
      );


    if (!rawName) {

      continue;
    }


    /*
     * Section/header rows can exist inside the same sheet.
     * Example in the supplied Worker Master:
     *   E112 = 氏名（上段：フリガナ）...
     */
    if (
      rawName.indexOf(
        '氏名'
      )
      !==
      -1
    ) {

      continue;
    }


    /*
     * E:F is a merged name cell.
     * In OpenXML the merged value is stored in E only; F is blank.
     *
     * Web/PDF display rule:
     * - show surname only
     * - preserve the original merged-cell value separately
     */
    const displayName =
      extractWorkerSurname_(
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

        fullName:
          normalizeWorkerFullName_(
            rawName
          ),

        nameRaw:
          rawName,

        phs:
          '-',

        qualifications:
          {
            gas:
              hasQualificationValue_(
                qualificationRow.cells.I
              ),

            electric:
              hasQualificationValue_(
                qualificationRow.cells.J
              ),

            leader:
              hasQualificationValue_(
                qualificationRow.cells.K
              ),

            law60:
              hasQualificationValue_(
                qualificationRow.cells.L
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
 * =========================================================
 * FAST OpenXML helpers
 * =========================================================
 */

function getWorkbookSheetEntryByNameFast_(
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


/**
 * Fast shared-string parser.
 * Avoids XmlService.parse() on the workbook-global sharedStrings.xml.
 */
function parseSharedStringsFast_(
  entries
) {

  const blob =
    entries[
      'xl/sharedStrings.xml'
    ];


  if (!blob) {

    return [];
  }


  const xml =
    blob.getDataAsString(
      'UTF-8'
    );


  const strings =
    [];


  const siRegex =
    /<si\b[^>]*>([\s\S]*?)<\/si>/g;


  let siMatch;


  while (
    (
      siMatch =
        siRegex.exec(
          xml
        )
    )
    !==
    null
  ) {

    let value =
      '';


    const textRegex =
      /<t\b[^>]*>([\s\S]*?)<\/t>/g;


    let textMatch;


    while (
      (
        textMatch =
          textRegex.exec(
            siMatch[
              1
            ]
          )
      )
      !==
      null
    ) {

      value +=
        decodeXmlTextFast_(
          textMatch[
            1
          ]
        );
    }


    strings.push(
      value
    );
  }


  return strings;
}


/**
 * Read only selected columns from one row's XML.
 */
function readSelectedCellsFast_(
  rowXml,
  wantedColumns,
  sharedStrings
) {

  const values =
    {};


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
  const cellRegex =
    /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;


  let cellMatch;


  while (
    (
      cellMatch =
        cellRegex.exec(
          rowXml
        )
    )
    !==
    null
  ) {

    const attrs =
      cellMatch[
        1
      ]
      ||
      '';


    const body =
      cellMatch[
        2
      ]
      ||
      '';


    const refMatch =
      attrs.match(
        /\br="([A-Z]+)\d+"/
      );


    if (!refMatch) {

      continue;
    }


    const column =
      refMatch[
        1
      ];


    if (
      !wantedColumns[
        column
      ]
    ) {

      continue;
    }


    values[
      column
    ] =
      readCellValueFast_(
        attrs,
        body,
        sharedStrings
      );
  }


  return values;
}


function readCellValueFast_(
  attrs,
  body,
  sharedStrings
) {

  const typeMatch =
    attrs.match(
      /\bt="([^"]+)"/
    );


  const type =
    typeMatch
      ? typeMatch[
          1
        ]
      : '';


  if (
    type
    ===
    'inlineStr'
  ) {

    let value =
      '';


    const textRegex =
      /<t\b[^>]*>([\s\S]*?)<\/t>/g;


    let textMatch;


    while (
      (
        textMatch =
          textRegex.exec(
            body
          )
      )
      !==
      null
    ) {

      value +=
        decodeXmlTextFast_(
          textMatch[
            1
          ]
        );
    }


    return value;
  }


  const valueMatch =
    body.match(
      /<v>([\s\S]*?)<\/v>/
    );


  if (!valueMatch) {

    return '';
  }


  const raw =
    decodeXmlTextFast_(
      valueMatch[
        1
      ]
    );


  if (
    type
    ===
    's'
  ) {

    const index =
      Number(
        raw
      );


    return (
      sharedStrings[
        index
      ]
      !==
      undefined
    )
      ? sharedStrings[
          index
        ]
      : '';
  }


  if (
    type
    ===
    'b'
  ) {

    return raw
      ===
      '1';
  }


  return raw;
}


function decodeXmlTextFast_(
  value
) {

  return String(
    value
    ||
    ''
  )
    .replace(
      /&#x([0-9A-Fa-f]+);/g,
      function(
        whole,
        hex
      ) {

        return String.fromCodePoint(
          parseInt(
            hex,
            16
          )
        );
      }
    )
    .replace(
      /&#(\d+);/g,
      function(
        whole,
        decimal
      ) {

        return String.fromCodePoint(
          Number(
            decimal
          )
        );
      }
    )
    .replace(
      /&lt;/g,
      '<'
    )
    .replace(
      /&gt;/g,
      '>'
    )
    .replace(
      /&quot;/g,
      '"'
    )
    .replace(
      /&apos;/g,
      "'"
    )
    .replace(
      /&amp;/g,
      '&'
    );
}


/**
 * =========================================================
 * Normalization / qualification / cache
 * =========================================================
 */

function normalizeReferenceDisplayText_(
  value
) {

  const source =
    cleanCellText_(
      value
    );


  /*
   * NFKC is intentionally used for reference/master display text:
   * - ｷｵｸｼｱ -> キオクシア
   * - full-width ASCII -> half-width ASCII
   * - Japanese Kanji/Kana content remains readable
   */
  const normalized =
    source.normalize
      ? source.normalize(
          'NFKC'
        )
      : source;


  return normalizeTroubleDisplayText_(
    normalized
  )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
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
function extractLeaderDisplayName_(
  value
) {

  return extractWorkerSurname_(
    value
  );
}


/**
 * Attach Worker Master qualifications to each leader option.
 * Exact normalized full-name match is attempted first, then unique surname.
 * No guessing when multiple workers share the same surname.
 */
function attachLeaderWorkerMasterData_(
  leaders,
  workers
) {

  return leaders.map(
    function(leader) {

      const leaderRaw =
        normalizeWorkerFullName_(
          leader.nameRaw
          ||
          leader.name
        );


      const exact =
        workers.filter(
          function(worker) {

            return (
              normalizeWorkerFullName_(
                worker.fullName
                ||
                worker.name
              )
              ===
              leaderRaw
            );
          }
        );


      let matched =
        exact.length
        ===
        1
          ? exact[
              0
            ]
          : null;


      if (!matched) {

        const surnameMatches =
          workers.filter(
            function(worker) {

              return (
                String(
                  worker.name
                  ||
                  ''
                )
                ===
                String(
                  leader.name
                  ||
                  ''
                )
              );
            }
          );


        if (
          surnameMatches.length
          ===
          1
        ) {

          matched =
            surnameMatches[
              0
            ];
        }
      }


      return Object.assign(
        {},
        leader,
        {
          workerKey:
            matched
              ? matched.workerKey
              : '',

          qualifications:
            matched
              ? matched.qualifications
              : {},

          qualificationResolved:
            Boolean(
              matched
            )
        }
      );
    }
  );
}


function normalizeWorkerFullName_(
  value
) {

  return String(
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
function extractWorkerSurname_(
  value
) {

  const text =
    normalizeWorkerFullName_(
      value
    );


  if (!text) {

    return '';
  }


  /*
   * Normal case: surname + space + given name.
   */
  if (
    text.indexOf(
      ' '
    )
    !==
    -1
  ) {

    return text
      .split(
        ' '
      )[
        0
      ]
      .trim();
  }


  /*
   * Test/compact source pattern:
   * 佐藤１サトウ
   * 佐藤10サトウ
   *
   * Keep only the leading Kanji surname.
   */
  const compact =
    text.match(
      /^([々一-龯﨑髙]+)[0-9０-９]*[ァ-ヶー]+$/
    );


  if (
    compact
  ) {

    return compact[
      1
    ];
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


function getJsonCacheSafe_(
  cache,
  key
) {

  const cached =
    cache.get(
      key
    );


  if (!cached) {

    return null;
  }


  try {

    return JSON.parse(
      cached
    );
  }

  catch (error) {

    console.log(
      '[WARN] Cache JSON parse failed: '
      +
      key
    );


    return null;
  }
}


function putJsonCacheSmall_(
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
    >=
    90000
  ) {

    console.log(
      '[WARN] '
      +
      label
      +
      ' cache skipped. size='
      +
      json.length
    );


    return;
  }


  cache.put(
    key,
    json,
    seconds
  );
}
