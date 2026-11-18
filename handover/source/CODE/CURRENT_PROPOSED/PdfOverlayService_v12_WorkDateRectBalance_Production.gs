/**
 * =========================================================
 * PdfOverlayService v12 Production Ready
 * Emerg Master PDF Overlay Production Service
 *
 * Requires:
 * - PdfOverlayCoordinateMap_v10.gs
 * - Config.gs : getRequiredProperty_()
 * - BoxApi.gs : boxDownloadFile_(), boxUploadFile_()
 * - BoxUploadOrVersion.gs : boxUploadOrNewVersion_()
 * - PdfRuntimeLoader.gs : ensurePdfRuntime_()
 * - GAS compatibility: custom font embed uses subset=false
 * - GAS compatibility: pdfDoc.save({objectsPerTick:Number.MAX_SAFE_INTEGER})
 * - Work date: start time only; end time intentionally blank
 * - Work date blank balance: five U+3000 spaces after ～
 * - Work date rect uses exact Master PDF cell borders (no border masking)
 * - PHS values: field-specific 1.0pt upward correction
 * - Date placeholder whiteout: 1.8pt safe inset from cell border
 *   bypasses pdf-lib waitForTick()/setTimeout writer yield
 *
 * Script Properties:
 * - BOX_EMERG_MASTER_PDF_FILE_ID
 * - BOX_PDF_FONT_MEIRYO_FILE_ID
 *
 * Important:
 * - Work title is rebuilt from machineId + troubleName.
 * - Leading OFX / OBE is removed from machineId ONLY for workTitle.
 * - Separator is one SPACE. Never insert "_".
 * - workers[0..5].name: static `氏名:` remains in Master PDF,
 *   dynamic name is LEFT aligned and vertically centered.
 * - repairTroubleMode is REQUIRED and synced to Page1 + Page2.
 * =========================================================
 */


async function generateEmergPdfOverlayToBox(
  jobData,
  outputFolderId
) {

  const warnings =
    [];


  validateEmergPdfJobData_(
    jobData
  );


  if (!outputFolderId) {

    throw new Error(
      'outputFolderId가 없습니다.'
    );
  }


  const masterPdfFileId =
    getRequiredProperty_(
      'BOX_EMERG_MASTER_PDF_FILE_ID'
    );


  const fontFileId =
    getRequiredProperty_(
      'BOX_PDF_FONT_MEIRYO_FILE_ID'
    );


  /*
   * Production always gets the pinned pdf-lib/fontkit runtime
   * through PdfRuntimeLoader.gs.
   */
  const runtime =
    ensurePdfRuntime_();


  const masterBlob =
    boxDownloadFile_(
      masterPdfFileId
    );


  const fontBlob =
    boxDownloadFile_(
      fontFileId
    );


  const pdfBytes =
    await createEmergOverlayPdfBytes_(
      runtime.PDFLib,
      runtime.fontkit,
      unsignedBytes_(
        masterBlob.getBytes()
      ),
      unsignedBytes_(
        fontBlob.getBytes()
      ),
      jobData,
      warnings
    );


  const fileName =
    buildEmergPdfFileName_(
      jobData
    );


  const outputBlob =
    Utilities.newBlob(
      signedBytes_(
        pdfBytes
      ),
      'application/pdf',
      fileName
    );


  /*
   * Same-name policy:
   * - New name      -> new Box file
   * - Existing name -> upload as a new Box Version
   *
   * This preserves one stable file per output name
   * and keeps Box Version History.
   */
  const uploaded =
    boxUploadOrNewVersion_(
      outputFolderId,
      fileName,
      outputBlob
    );


  return {
    ok:
      true,

    fileId:
      String(
        uploaded.id
      ),

    fileName:
      fileName,

    uploadMode:
      uploaded.uploadMode
      ||
      'UNKNOWN',

    warnings:
      warnings,

    workTitle:
      buildEmergWorkTitle_(
        jobData.machineId,
        jobData.troubleName
      )
  };
}


/**
 * Async PDF generation.
 */
async function createEmergOverlayPdfBytes_(
  PDFLib,
  fontkitObj,
  masterBytes,
  fontBytes,
  jobData,
  warnings
) {

  const pdfDoc =
    await PDFLib.PDFDocument.load(
      masterBytes
    );


  pdfDoc.registerFontkit(
    fontkitObj
  );


  const font =
    await pdfDoc.embedFont(
      fontBytes,
      {
        subset:
          false
      }
    );


  const pages =
    pdfDoc.getPages();


  if (
    pages.length
    <
    2
  ) {

    throw new Error(
      'Emerg Master PDF가 2페이지가 아닙니다.'
    );
  }


  const page1 =
    pages[
      0
    ];


  const page2 =
    pages[
      1
    ];


  /*
   * ---------------------------------------------------------
   * 1. Repair / Trouble
   * ---------------------------------------------------------
   */
  drawRepairTroubleSync_(
    PDFLib,
    page1,
    page2,
    jobData.repairTroubleMode
  );


  /*
   * ---------------------------------------------------------
   * 2. Main fields
   * ---------------------------------------------------------
   */
  const workTitle =
    buildEmergWorkTitle_(
      jobData.machineId,
      jobData.troubleName
    );


  drawMappedText_(
    page1,
    font,
    EMERG_PDF_COORD_MAP
      .page1
      .fields
      .workTitle,
    workTitle,
    PDFLib
  );


  drawMappedText_(
    page1,
    font,
    EMERG_PDF_COORD_MAP
      .page1
      .fields
      .machineId,
    safeText_(
      jobData.machineId
    ),
    PDFLib
  );


  drawMappedText_(
    page1,
    font,
    EMERG_PDF_COORD_MAP
      .page1
      .fields
      .workLocation,
    safeText_(
      jobData.workLocation
    ),
    PDFLib
  );


  /*
   * ---------------------------------------------------------
   * 3. Work date / time
   * ---------------------------------------------------------
   */
  const workDateText =
    buildEmergWorkDateText_(
      jobData
    );


  if (workDateText) {

    drawMappedRectText_(
      page1,
      font,
      EMERG_PDF_COORD_MAP
        .page1
        .fields
        .workDateTime,
      workDateText,
      PDFLib
    );
  }


  /*
   * ---------------------------------------------------------
   * 4. Leader
   * ---------------------------------------------------------
   */
  drawMappedText_(
    page1,
    font,
    EMERG_PDF_COORD_MAP
      .page1
      .fields
      .leaderName,
    safeText_(
      jobData.leader
    ),
    PDFLib
  );


  const leaderPHS =
    normalizePHS_(
      jobData.leaderPHS
    );


  if (
    leaderPHS
    ===
    '-'
  ) {

    warnings.push(
      '職長のPHSが空欄のため「-」で出力しました。'
    );
  }


  drawMappedText_(
    page1,
    font,
    EMERG_PDF_COORD_MAP
      .page1
      .fields
      .leaderPHS,
    leaderPHS,
    PDFLib
  );


  /*
   * ---------------------------------------------------------
   * 5. Workers 1~6
   * ---------------------------------------------------------
   */
  const workers =
    Array.isArray(
      jobData.workers
    )
      ? jobData.workers
      : [];


  for (
    let i = 0;
    i < 6;
    i++
  ) {

    const worker =
      workers[
        i
      ]
      ||
      {};


    const map =
      EMERG_PDF_COORD_MAP
        .page1
        .fields
        .workers[
          i
        ];


    /*
     * Master PDF already contains red `氏名:`.
     * Draw ONLY the name immediately after that label:
     * LEFT aligned + vertically centered.
     */
    drawMappedText_(
      page1,
      font,
      map.name,
      safeText_(
        worker.name
      ),
      PDFLib
    );


    drawMappedText_(
      page1,
      font,
      map.phs,
      normalizePHS_(
        worker.phs
      ),
      PDFLib
    );
  }


  /*
   * ---------------------------------------------------------
   * 6. Qualification ellipses - Page 1
   * ---------------------------------------------------------
   */
  drawQualificationSet_(
    PDFLib,
    page1,
    EMERG_PDF_COORD_MAP
      .page1
      .qualifications,
    '職長',
    jobData.leaderQualifications
      ||
      jobData.leaderQualification
      ||
      jobData.qualifications
  );


  for (
    let i = 0;
    i < 6;
    i++
  ) {

    const worker =
      workers[
        i
      ]
      ||
      {};


    drawQualificationSet_(
      PDFLib,
      page1,
      EMERG_PDF_COORD_MAP
        .page1
        .qualifications,
      '作業者'
      +
      (
        i
        +
        1
      ),
      worker.qualifications
    );
  }


  /*
   * ---------------------------------------------------------
   * 7. Page 2 Leader + qualifications
   * ---------------------------------------------------------
   */
  drawMappedText_(
    page2,
    font,
    EMERG_PDF_COORD_MAP
      .page2
      .fields
      .leaderName,
    safeText_(
      jobData.leader
    ),
    PDFLib
  );


  drawMappedText_(
    page2,
    font,
    EMERG_PDF_COORD_MAP
      .page2
      .fields
      .leaderPHS,
    leaderPHS,
    PDFLib
  );


  drawQualificationSet_(
    PDFLib,
    page2,
    EMERG_PDF_COORD_MAP
      .page2
      .qualifications,
    '職長',
    jobData.leaderQualifications
      ||
      jobData.leaderQualification
      ||
      jobData.qualifications
  );


  /*
   * Apps Script has no setTimeout.
   * pdf-lib's writer yields through waitForTick()/setTimeout based on
   * objectsPerTick. A practically unreachable objectsPerTick value keeps
   * serialization synchronous from GAS's perspective.
   */
  return await pdfDoc.save(
    {
      objectsPerTick:
        Number.MAX_SAFE_INTEGER
    }
  );
}


/**
 * B6/C6 + B50/C50 synchronized.
 */
function drawRepairTroubleSync_(
  PDFLib,
  page1,
  page2,
  mode
) {

  const normalized =
    String(
      mode
      ||
      ''
    )
      .trim()
      .toUpperCase();


  if (
    normalized
    !==
    'REPAIR'
    &&
    normalized
    !==
    'TROUBLE'
  ) {

    throw new Error(
      'repairTroubleMode는 REPAIR 또는 TROUBLE 중 하나를 반드시 선택해야 합니다.'
    );
  }


  drawPdfEllipse_(
    PDFLib,
    page1,
    EMERG_PDF_COORD_MAP
      .page1
      .repairTrouble[
        normalized
      ]
  );


  drawPdfEllipse_(
    PDFLib,
    page2,
    EMERG_PDF_COORD_MAP
      .page2
      .repairTrouble[
        normalized
      ]
  );
}


/**
 * Qualification group.
 */
function drawQualificationSet_(
  PDFLib,
  page,
  coordinateMap,
  personPrefix,
  qualifications
) {

  const labels =
    [
      '安衛法60条',
      '職長',
      '電気',
      'ガス'
    ];


  labels.forEach(
    function(label) {

      if (
        hasQualification_(
          qualifications,
          label
        )
      ) {

        const key =
          personPrefix
          +
          '-'
          +
          label;


        const rect =
          coordinateMap[
            key
          ];


        if (!rect) {

          throw new Error(
            'Qualification PDF 좌표가 없습니다: '
            +
            key
          );
        }


        drawPdfEllipse_(
          PDFLib,
          page,
          rect
        );
      }
    }
  );
}


function hasQualification_(
  source,
  qualification
) {

  if (!source) {

    return false;
  }


  const aliases =
    {
      '安衛法60条':
        [
          '安衛法60条',
          'law60',
          'safetyLaw60'
        ],

      '職長':
        [
          '職長',
          'leader',
          'foreman'
        ],

      '電気':
        [
          '電気',
          'electric'
        ],

      'ガス':
        [
          'ガス',
          'gas'
        ]
    };


  const candidates =
    aliases[
      qualification
    ]
    ||
    [
      qualification
    ];


  if (
    Array.isArray(
      source
    )
  ) {

    return candidates.some(
      function(key) {

        return source.some(
          function(value) {

            return (
              String(
                value
              )
                .trim()
                .toLowerCase()
              ===
              String(
                key
              )
                .trim()
                .toLowerCase()
            );
          }
        );
      }
    );
  }


  if (
    typeof source
    ===
    'object'
  ) {

    return candidates.some(
      function(key) {

        const value =
          source[
            key
          ];


        return (
          value
          ===
          true
          ||
          value
          ===
          1
          ||
          String(
            value
            ||
            ''
          )
            .trim()
            .toLowerCase()
          ===
          'true'
          ||
          String(
            value
            ||
            ''
          )
            .trim()
          ===
          '○'
          ||
          String(
            value
            ||
            ''
          )
            .trim()
          ===
          '✓'
        );
      }
    );
  }


  const normalized =
    String(
      source
    );


  return candidates.some(
    function(key) {

      return (
        normalized.indexOf(
          key
        )
        !==
        -1
      );
    }
  );
}


/**
 * Work title for E6 / PDF work-title field.
 *
 * IMPORTANT:
 * OBEV504 + POLI1 Sensor Error
 * -> V504 POLI1 Sensor Error
 *
 * No separator underscore.
 */
function buildEmergWorkTitle_(
  machineId,
  troubleName
) {

  const shortMachineId =
    String(
      machineId
      ||
      ''
    )
      .trim()
      .replace(
        /^(?:OFX|OBE)/i,
        ''
      );


  const alarmName =
    String(
      troubleName
      ||
      ''
    )
      .trim();


  return [
    shortMachineId,
    alarmName
  ]
    .filter(
      function(value) {

        return Boolean(
          value
        );
      }
    )
    .join(
      ' '
    );
}


function validateEmergPdfJobData_(
  jobData
) {

  if (
    !jobData
    ||
    typeof jobData
    !==
    'object'
  ) {

    throw new Error(
      'JOB_DATA가 없습니다.'
    );
  }


  if (
    !jobData.repairTroubleMode
  ) {

    throw new Error(
      '修理／トラブルを選択してください。'
    );
  }


  const mode =
    String(
      jobData.repairTroubleMode
    )
      .toUpperCase();


  if (
    mode
    !==
    'REPAIR'
    &&
    mode
    !==
    'TROUBLE'
  ) {

    throw new Error(
      'repairTroubleMode 값이 잘못되었습니다.'
    );
  }
}


function drawMappedText_(
  page,
  font,
  config,
  text,
  PDFLib
) {

  const value =
    safeText_(
      text
    );


  if (!value) {

    return;
  }


  const size =
    Number(
      config.fontSize
      ||
      6
    );


  const pageHeight =
    page.getHeight();


  const targetCenterY =
    pageHeight
    -
    Number(
      config.centerY
    );


  const ascent =
    getFontHeight_(
      font,
      size,
      false
    );


  const total =
    getFontHeight_(
      font,
      size,
      true
    );


  const descender =
    Math.max(
      0,
      total
      -
      ascent
    );


  const downPt =
    Number(
      (
        EMERG_PDF_COORD_MAP
        &&
        EMERG_PDF_COORD_MAP.rules
        &&
        EMERG_PDF_COORD_MAP.rules.dynamicTextVerticalAlign
      )
        ? EMERG_PDF_COORD_MAP.rules.dynamicTextVerticalAlign.downPt
        : 0
    );


  /*
   * Common Meiryo baseline calibration.
   *
   * config.yAdjustPt:
   *   0    = use common baseline as-is
   *  -1.0  = move field 1pt UP
   *  +1.0  = move field 1pt DOWN
   *
   * Example:
   * PHS values use -1.0 because the smaller font rendered lower
   * than the adjacent static PHS label.
   */
  const fieldAdjustPt =
    Number(
      config.yAdjustPt
      ||
      0
    );


  const effectiveDownPt =
    downPt
    +
    fieldAdjustPt;


  const baselineY =
    targetCenterY
    -
    (
      ascent
      -
      descender
    )
    /
    2
    -
    effectiveDownPt;


  page.drawText(
    value,
    {
      x:
        Number(
          config.x
        ),

      y:
        baselineY,

      size:
        size,

      font:
        font,

      color:
        PDFLib.rgb(
          0,
          0,
          0
        )
    }
  );
}


function drawMappedRectText_(
  page,
  font,
  config,
  text,
  PDFLib
) {

  const rect =
    config.rect;


  if (
    !rect
    ||
    rect.length
    !==
    4
  ) {

    throw new Error(
      'PDF rect 설정이 잘못되었습니다.'
    );
  }


  const value =
    safeText_(
      text
    );


  if (!value) {

    return;
  }


  const x0 =
    Number(
      rect[
        0
      ]
    );


  const top =
    Number(
      rect[
        1
      ]
    );


  const x1 =
    Number(
      rect[
        2
      ]
    );


  const bottom =
    Number(
      rect[
        3
      ]
    );


  const pageHeight =
    page.getHeight();


  const width =
    x1
    -
    x0;


  const height =
    bottom
    -
    top;


  const pdfY =
    pageHeight
    -
    bottom;


  if (
    config.whiteout
  ) {

    /*
     * Keep the whiteout safely inside the cell.
     * The previous 0.8pt inset could visually erase/overrun
     * part of the black medium border.
     */
    const inset =
      Number(
        config.whiteoutInsetPt
        ||
        1.8
      );


    page.drawRectangle(
      {
        x:
          x0
          +
          inset,

        y:
          pdfY
          +
          inset,

        width:
          Math.max(
            0,
            width
            -
            (
              inset
              *
              2
            )
          ),

        height:
          Math.max(
            0,
            height
            -
            (
              inset
              *
              2
            )
          ),

        color:
          PDFLib.rgb(
            1,
            1,
            1
          )
      }
    );
  }


  const size =
    Number(
      config.fontSize
      ||
      6
    );


  const textWidth =
    font.widthOfTextAtSize(
      value,
      size
    );


  let x =
    x0
    +
    2;


  if (
    config.align
    ===
    'center'
  ) {

    x =
      x0
      +
      Math.max(
        0,
        (
          width
          -
          textWidth
        )
        /
        2
      );
  }


  drawMappedText_(
    page,
    font,
    {
      x:
        x,

      centerY:
        (
          top
          +
          bottom
        )
        /
        2,

      fontSize:
        size,

      yAdjustPt:
        Number(
          config.yAdjustPt
          ||
          0
        )
    },
    value,
    PDFLib
  );
}


function drawPdfEllipse_(
  PDFLib,
  page,
  rect
) {

  if (
    !rect
    ||
    rect.length
    !==
    4
  ) {

    throw new Error(
      'Ellipse PDF 좌표가 없습니다.'
    );
  }


  const x0 =
    Number(
      rect[
        0
      ]
    );


  const top =
    Number(
      rect[
        1
      ]
    );


  const x1 =
    Number(
      rect[
        2
      ]
    );


  const bottom =
    Number(
      rect[
        3
      ]
    );


  const pageHeight =
    page.getHeight();


  const centerX =
    (
      x0
      +
      x1
    )
    /
    2;


  const centerY =
    pageHeight
    -
    (
      top
      +
      bottom
    )
    /
    2;


  page.drawEllipse(
    {
      x:
        centerX,

      y:
        centerY,

      xScale:
        (
          x1
          -
          x0
        )
        /
        2,

      yScale:
        (
          bottom
          -
          top
        )
        /
        2,

      borderColor:
        PDFLib.rgb(
          0,
          0,
          0
        ),

      borderWidth:
        0.9
    }
  );
}


function buildEmergWorkDateText_(
  jobData
) {

  if (
    !jobData.workDate
  ) {

    return '';
  }


  const date =
    String(
      jobData.workDate
    )
      .trim();


  const start =
    String(
      jobData.startTime
      ||
      ''
    )
      .trim();


  let dateText =
    date;


  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      date
    )
  ) {

    const parts =
      date.split(
        '-'
      );


    dateText =
      Number(
        parts[
          0
        ]
      )
      +
      '年'
      +
      Number(
        parts[
          1
        ]
      )
      +
      '月'
      +
      Number(
        parts[
          2
        ]
      )
      +
      '日';
  }


  if (!start) {

    return dateText;
  }


  /*
   * Operations rule:
   * - print start time only
   * - end time stays blank
   * - 5 ideographic spaces after "～" visually balance the
   *   start-time area without printing a fake end time
   *
   * Example:
   * 2026年9月27日  (10時00分 ～　　　　　)
   */
  const endBlank =
    '\u3000\u3000\u3000\u3000\u3000';


  return (
    dateText
    +
    '  ('
    +
    formatJapaneseTime_(
      start
    )
    +
    ' ～'
    +
    endBlank
    +
    ')'
  );
}


function formatJapaneseTime_(
  value
) {

  const text =
    String(
      value
      ||
      ''
    )
      .trim();


  if (!text) {

    return '';
  }


  const match =
    text.match(
      /^(\d{1,2}):(\d{2})$/
    );


  if (!match) {

    return text;
  }


  return (
    Number(
      match[
        1
      ]
    )
    +
    '時'
    +
    match[
      2
    ]
    +
    '分'
  );
}


function normalizePHS_(
  value
) {

  const text =
    String(
      value
      ||
      ''
    )
      .trim();


  return text
    ? text
    : '-';
}


function buildEmergPdfFileName_(
  jobData
) {

  const workTitle =
    buildEmergWorkTitle_(
      jobData.machineId,
      jobData.troubleName
    );


  const safe =
    workTitle
      .replace(
        /[\\/:*?"<>|]/g,
        '_'
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();


  return (
    'Emerg_'
    +
    (
      safe
      ||
      'Output'
    )
    +
    '.pdf'
  );
}


function safeText_(
  value
) {

  return String(
    value
    ||
    ''
  )
    .trim();
}


function getFontHeight_(
  font,
  size,
  withDescender
) {

  try {

    return font.heightAtSize(
      size,
      {
        descender:
          withDescender
      }
    );
  }

  catch (error) {

    return font.heightAtSize(
      size
    );
  }
}


function getPdfLibGlobal_() {

  if (
    typeof PDFLib
    ===
    'undefined'
  ) {

    throw new Error(
      'PDFLib가 GAS 프로젝트에 로드되어 있지 않습니다.'
    );
  }


  return PDFLib;
}


function getPdfFontkitGlobal_() {

  if (
    typeof fontkit
    !==
    'undefined'
  ) {

    return fontkit;
  }


  if (
    typeof Fontkit
    !==
    'undefined'
  ) {

    return Fontkit;
  }


  throw new Error(
    'fontkit가 GAS 프로젝트에 로드되어 있지 않습니다.'
  );
}


function unsignedBytes_(
  signed
) {

  return new Uint8Array(
    signed.map(
      function(value) {

        return (
          value
          <
          0
            ? value
              +
              256
            : value
        );
      }
    )
  );
}


function signedBytes_(
  uint8
) {

  return Array.from(
    uint8,
    function(value) {

      return (
        value
        >
        127
          ? value
            -
            256
          : value
      );
    }
  );
}


/**
 * Small rule test that does not require pdf-lib.
 */
function testEmergWorkTitleRule() {

  const actual =
    buildEmergWorkTitle_(
      'OBEV504',
      'POLI1 Sensor Error'
    );


  const expected =
    'V504 POLI1 Sensor Error';


  console.log(
    'actual   = '
    +
    actual
  );


  console.log(
    'expected = '
    +
    expected
  );


  if (
    actual
    !==
    expected
  ) {

    throw new Error(
      'Work title rule NG'
    );
  }


  console.log(
    'Work title rule OK'
  );
}
