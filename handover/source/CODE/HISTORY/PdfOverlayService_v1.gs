/**
 * =========================================================
 * PdfOverlayService v1
 * Emerg Master PDF Overlay Production Service
 *
 * Requires:
 * - PdfOverlayCoordinateMap_v3.gs
 * - Config.gs : getRequiredProperty_()
 * - BoxApi.gs : boxDownloadFile_(), boxUploadFile_()
 * - pdf-lib bundled in the GAS project as global PDFLib
 * - fontkit bundled in the GAS project as global fontkit or Fontkit
 *
 * Script Properties:
 * - BOX_EMERG_MASTER_PDF_FILE_ID
 * - BOX_PDF_FONT_FILE_ID
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


function generateEmergPdfOverlayToBox(
  jobData,
  outputFolderId
) {

  const warnings =
    [];


  validateEmergPdfJobData_(
    jobData
  );


  const masterPdfFileId =
    getRequiredProperty_(
      'BOX_EMERG_MASTER_PDF_FILE_ID'
    );


  const fontFileId =
    getRequiredProperty_(
      'BOX_PDF_FONT_FILE_ID'
    );


  if (!outputFolderId) {

    throw new Error(
      'outputFolderId가 없습니다.'
    );
  }


  const pdfLib =
    getPdfLibGlobal_();


  const pdfFontkit =
    getPdfFontkitGlobal_();


  const masterBlob =
    boxDownloadFile_(
      masterPdfFileId
    );


  const fontBlob =
    boxDownloadFile_(
      fontFileId
    );


  const masterBytes =
    unsignedBytes_(
      masterBlob.getBytes()
    );


  const fontBytes =
    unsignedBytes_(
      fontBlob.getBytes()
    );


  const result =
    waitForPromise_(
      createEmergOverlayPdfBytes_(
        pdfLib,
        pdfFontkit,
        masterBytes,
        fontBytes,
        jobData,
        warnings
      )
    );


  const fileName =
    buildEmergPdfFileName_(
      jobData
    );


  const outputBlob =
    Utilities.newBlob(
      signedBytes_(
        result
      ),
      'application/pdf',
      fileName
    );


  const uploaded =
    boxUploadFile_(
      outputFolderId,
      fileName,
      outputBlob
    );


  return {
    ok:
      true,

    fileId:
      uploaded.id,

    fileName:
      fileName,

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
          true
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


  return await pdfDoc.save();
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


  const baselineY =
    targetCenterY
    -
    (
      ascent
      -
      descender
    )
    /
    2;


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

    page.drawRectangle(
      {
        x:
          x0
          +
          0.8,

        y:
          pdfY
          +
          0.8,

        width:
          width
          -
          1.6,

        height:
          height
          -
          1.6,

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
        size
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
    jobData.workDateText
  ) {

    return String(
      jobData.workDateText
    );
  }


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


  const end =
    String(
      jobData.endTime
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


  if (
    !start
    &&
    !end
  ) {

    return dateText;
  }


  return (
    dateText
    +
    '  ('
    +
    formatJapaneseTime_(
      start
    )
    +
    ' ～ '
    +
    formatJapaneseTime_(
      end
    )
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
 * Apps Script synchronous wrapper for Promise.
 *
 * NOTE:
 * GAS V8 supports async/Promise semantics, but Apps Script entry functions
 * do not automatically await returned Promises in every calling pattern.
 * This helper intentionally requires a project-level Promise runner.
 *
 * For the first smoke test, call generateEmergPdfOverlayToBoxAsync_()
 * if your current project supports async entry functions directly.
 */
function waitForPromise_(
  promise
) {

  throw new Error(
    [
      'PdfOverlayService의 PDF core는 준비되었습니다.',
      '다음 STEP에서 현재 GAS 프로젝트의 pdf-lib/fontkit 로딩방식에 맞춰 Promise 실행부를 연결해야 합니다.',
      '이 함수는 의도적으로 아직 활성화하지 않았습니다.'
    ].join(
      '\n'
    )
  );
}


/**
 * Async entry for environments where Apps Script accepts async execution.
 */
async function generateEmergPdfOverlayToBoxAsync_(
  jobData,
  outputFolderId
) {

  const warnings =
    [];


  validateEmergPdfJobData_(
    jobData
  );


  const masterPdfFileId =
    getRequiredProperty_(
      'BOX_EMERG_MASTER_PDF_FILE_ID'
    );


  const fontFileId =
    getRequiredProperty_(
      'BOX_PDF_FONT_FILE_ID'
    );


  const PDFLibObj =
    getPdfLibGlobal_();


  const fontkitObj =
    getPdfFontkitGlobal_();


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
      PDFLibObj,
      fontkitObj,
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


  const uploaded =
    boxUploadFile_(
      outputFolderId,
      fileName,
      outputBlob
    );


  return {
    ok:
      true,

    fileId:
      uploaded.id,

    fileName:
      fileName,

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
