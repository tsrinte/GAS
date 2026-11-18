/**
 * =========================================================
 * PdfRuntimeLoader + Smoke Test v1
 *
 * 목적
 * - pdf-lib + @pdf-lib/fontkit를 GAS V8에서 로드
 * - Master PDF + Meiryo Regular을 실제로 읽어 Overlay 가능 여부 확인
 * - 운영 Font 정책: Meiryo Regular / non-bold
 *
 * 기본 동작
 * 1) Box에 JS bundle File ID가 있으면 Box 우선
 * 2) 없으면 pinned CDN 사용
 *
 * Optional Script Properties:
 * - BOX_PDF_LIB_JS_FILE_ID
 * - BOX_PDF_FONTKIT_JS_FILE_ID
 *
 * Required Script Properties:
 * - BOX_EMERG_MASTER_PDF_FILE_ID
 * - BOX_PDF_FONT_MEIRYO_FILE_ID
 * - BOX_TEST_FOLDER_ID
 *
 * Pinned versions:
 * - pdf-lib 1.17.1
 * - @pdf-lib/fontkit 1.1.1
 *
 * Requires:
 * - getRequiredProperty_()
 * - getBoxAuthHeader_()
 * - boxDownloadFile_()
 * - boxUploadFile_()
 * - PdfOverlayCoordinateMap_v3.gs
 * =========================================================
 */


const PDF_RUNTIME_CONFIG_ =
  {
    pdfLib:
      {
        version:
          '1.17.1',

        cdn:
          'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',

        fallbackCdn:
          'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',

        boxProperty:
          'BOX_PDF_LIB_JS_FILE_ID'
      },

    fontkit:
      {
        version:
          '1.1.1',

        cdn:
          'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js',

        fallbackCdn:
          'https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js',

        boxProperty:
          'BOX_PDF_FONTKIT_JS_FILE_ID'
      }
  };


/**
 * 실행 함수.
 *
 * 성공 조건:
 * - PDFLib global OK
 * - fontkit global OK
 * - Meiryo full embed OK (subset=false: GAS setTimeout compatibility)
 * - Master PDF load/save OK
 * - Box에 SMOKE_PDF_OVERLAY...pdf 생성
 */
async function runPdfRuntimeSmokeTest() {

  console.log(
    '=============================='
  );

  console.log(
    '[PDF RUNTIME SMOKE TEST] START'
  );

  console.log(
    '=============================='
  );


  const runtime =
    ensurePdfRuntime_();


  console.log(
    '[1] PDF Runtime Load OK'
  );

  console.log(
    'pdf-lib version : '
    +
    PDF_RUNTIME_CONFIG_
      .pdfLib
      .version
  );

  console.log(
    'fontkit version : '
    +
    PDF_RUNTIME_CONFIG_
      .fontkit
      .version
  );

  console.log(
    'pdf-lib source  : '
    +
    runtime.sources.pdfLib
  );

  console.log(
    'fontkit source  : '
    +
    runtime.sources.fontkit
  );


  const masterPdfId =
    getRequiredProperty_(
      'BOX_EMERG_MASTER_PDF_FILE_ID'
    );


  const meiryoFontId =
    getRequiredProperty_(
      'BOX_PDF_FONT_MEIRYO_FILE_ID'
    );


  const testFolderId =
    getRequiredProperty_(
      'BOX_TEST_FOLDER_ID'
    );


  const masterBlob =
    boxDownloadFile_(
      masterPdfId
    );


  const fontBlob =
    boxDownloadFile_(
      meiryoFontId
    );


  console.log(
    '[2] Master PDF / Meiryo Download OK'
  );


  const PDFLibObj =
    runtime.PDFLib;


  const pdfDoc =
    await PDFLibObj
      .PDFDocument
      .load(
        toUint8Array_(
          masterBlob.getBytes()
        )
      );


  pdfDoc.registerFontkit(
    runtime.fontkit
  );


  const meiryo =
    await pdfDoc.embedFont(
      toUint8Array_(
        fontBlob.getBytes()
      ),
      {
        subset:
          false
      }
    );


  console.log(
    '[3] Meiryo Regular Embed OK / subset=false'
  );


  const pages =
    pdfDoc.getPages();


  if (
    pages.length
    !==
    2
  ) {

    throw new Error(
      'Master PDF page count expected=2 actual='
      +
      pages.length
    );
  }


  const page1 =
    pages[
      0
    ];


  const map =
    EMERG_PDF_COORD_MAP;


  /*
   * Smoke Test:
   * - work title
   * - worker1 name (Meiryo 6.4pt / LEFT / vertical-center)
   * - REPAIR ellipse
   *
   * 실제 production 입력은 PdfOverlayService가 수행.
   */
  drawRuntimeSmokeText_(
    page1,
    meiryo,
    map
      .page1
      .fields
      .workTitle,
    'V504 POLI1 Sensor Error',
    PDFLibObj
  );


  drawRuntimeSmokeText_(
    page1,
    meiryo,
    map
      .page1
      .fields
      .workers[
        0
      ]
      .name,
    '佐藤',
    PDFLibObj
  );


  drawRuntimeSmokeEllipse_(
    page1,
    map
      .page1
      .repairTrouble
      .REPAIR,
    PDFLibObj
  );


  /*
   * Page2 repair sync도 동시에 확인
   */
  drawRuntimeSmokeEllipse_(
    pages[
      1
    ],
    map
      .page2
      .repairTrouble
      .REPAIR,
    PDFLibObj
  );


  const pdfBytes =
    await pdfDoc.save();


  console.log(
    '[4] PDF Overlay / Save OK'
  );


  const time =
    Utilities.formatDate(
      new Date(),
      'Asia/Tokyo',
      'yyyyMMdd_HHmmss'
    );


  const fileName =
    'SMOKE_PDF_OVERLAY_MEIRYO_'
    +
    time
    +
    '.pdf';


  const pdfBlob =
    Utilities.newBlob(
      toSignedByteArray_(
        pdfBytes
      ),
      'application/pdf',
      fileName
    );


  const uploaded =
    boxUploadFile_(
      testFolderId,
      fileName,
      pdfBlob
    );


  console.log(
    '[5] Box PDF Upload OK'
  );

  console.log(
    'PDF File ID   : '
    +
    uploaded.id
  );

  console.log(
    'PDF File Name : '
    +
    fileName
  );


  console.log(
    '=============================='
  );

  console.log(
    '[PDF RUNTIME SMOKE TEST] RESULT = OK'
  );

  console.log(
    '=============================='
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

    pdfLibSource:
      runtime.sources.pdfLib,

    fontkitSource:
      runtime.sources.fontkit,

    fontPolicy:
      'Meiryo Regular / non-bold'
  };
}


/**
 * Runtime loader.
 */
function ensurePdfRuntime_() {

  let pdfLibObj =
    getGlobalValue_(
      'PDFLib'
    );


  let fontkitObj =
    getGlobalValue_(
      'fontkit'
    );


  const sources =
    {
      pdfLib:
        pdfLibObj
          ? 'ALREADY_LOADED'
          : '',

      fontkit:
        fontkitObj
          ? 'ALREADY_LOADED'
          : ''
    };


  if (!pdfLibObj) {

    const result =
      loadRuntimeBundle_(
        PDF_RUNTIME_CONFIG_
          .pdfLib,
        'PDFLib'
      );


    pdfLibObj =
      result.value;

    sources.pdfLib =
      result.source;
  }


  if (!fontkitObj) {

    const result =
      loadRuntimeBundle_(
        PDF_RUNTIME_CONFIG_
          .fontkit,
        'fontkit'
      );


    fontkitObj =
      result.value;

    sources.fontkit =
      result.source;
  }


  if (
    !pdfLibObj
    ||
    !pdfLibObj.PDFDocument
  ) {

    throw new Error(
      'PDFLib global 생성 실패'
    );
  }


  if (!fontkitObj) {

    throw new Error(
      'fontkit global 생성 실패'
    );
  }


  return {
    PDFLib:
      pdfLibObj,

    fontkit:
      fontkitObj,

    sources:
      sources
  };
}


/**
 * Bundle loading priority:
 * 1) Box system resource
 * 2) jsDelivr pinned CDN
 * 3) unpkg pinned CDN
 */
function loadRuntimeBundle_(
  config,
  expectedGlobal
) {

  const props =
    PropertiesService
      .getScriptProperties();


  const boxId =
    String(
      props.getProperty(
        config.boxProperty
      )
      ||
      ''
    )
      .trim();


  if (boxId) {

    try {

      const blob =
        boxDownloadFile_(
          boxId
        );


      evaluateUmdBundle_(
        blob.getDataAsString(
          'UTF-8'
        )
      );


      const value =
        getGlobalValue_(
          expectedGlobal
        );


      if (value) {

        return {
          value:
            value,

          source:
            'BOX:'
            +
            boxId
        };
      }
    }

    catch (error) {

      console.log(
        '[WARN] Box bundle load failed: '
        +
        (
          error
          &&
          error.message
            ? error.message
            : String(
                error
              )
        )
      );
    }
  }


  const urls =
    [
      config.cdn,
      config.fallbackCdn
    ];


  for (
    let i = 0;
    i < urls.length;
    i++
  ) {

    try {

      const response =
        UrlFetchApp.fetch(
          urls[
            i
          ],
          {
            method:
              'get',

            followRedirects:
              true,

            muteHttpExceptions:
              true
          }
        );


      if (
        response.getResponseCode()
        !==
        200
      ) {

        console.log(
          '[WARN] Bundle HTTP '
          +
          response.getResponseCode()
          +
          ' : '
          +
          urls[
            i
          ]
        );

        continue;
      }


      evaluateUmdBundle_(
        response.getContentText(
          'UTF-8'
        )
      );


      const value =
        getGlobalValue_(
          expectedGlobal
        );


      if (value) {

        return {
          value:
            value,

          source:
            urls[
              i
            ]
        };
      }
    }

    catch (error) {

      console.log(
        '[WARN] Bundle load failed: '
        +
        urls[
          i
        ]
        +
        ' / '
        +
        (
          error
          &&
          error.message
            ? error.message
            : String(
                error
              )
        )
      );
    }
  }


  throw new Error(
    [
      expectedGlobal
      +
      ' library load failed.',
      'Box bundle 또는 pinned CDN을 확인하세요.'
    ].join(
      '\n'
    )
  );
}


/**
 * Browser UMD bundle을 GAS V8 global scope에 로드.
 *
 * GAS에는 window가 없으므로 globalThis/self alias를 제공.
 */
function evaluateUmdBundle_(
  source
) {

  const shim =
    [
      'var window = globalThis;',
      'var self = globalThis;',
      'var exports = undefined;',
      'var module = undefined;',
      'var define = undefined;'
    ].join(
      '\n'
    )
    +
    '\n';


  /*
   * indirect eval -> global scope
   */
  (
    0,
    eval
  )(
    shim
    +
    String(
      source
    )
  );
}


function getGlobalValue_(
  name
) {

  try {

    if (
      typeof globalThis
      !==
      'undefined'
      &&
      globalThis[
        name
      ]
    ) {

      return globalThis[
        name
      ];
    }
  }

  catch (error) {

    // continue
  }


  return null;
}


function drawRuntimeSmokeText_(
  page,
  font,
  config,
  text,
  PDFLibObj
) {

  const size =
    Number(
      config.fontSize
      ||
      6
    );


  const pageHeight =
    page.getHeight();


  const centerY =
    pageHeight
    -
    Number(
      config.centerY
    );


  /*
   * pdf-lib font metric:
   * heightAtSize(false) ≒ ascender height
   * heightAtSize(true)  = descender 포함 total height
   */
  let ascent =
    font.heightAtSize(
      size,
      {
        descender:
          false
      }
    );


  let total =
    font.heightAtSize(
      size,
      {
        descender:
          true
      }
    );


  const descender =
    Math.max(
      0,
      total
      -
      ascent
    );


  const y =
    centerY
    -
    (
      ascent
      -
      descender
    )
    /
    2;


  page.drawText(
    text,
    {
      x:
        Number(
          config.x
        ),

      y:
        y,

      size:
        size,

      font:
        font,

      color:
        PDFLibObj.rgb(
          0,
          0,
          0
        )
    }
  );
}


function drawRuntimeSmokeEllipse_(
  page,
  rect,
  PDFLibObj
) {

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


  page.drawEllipse(
    {
      x:
        (
          x0
          +
          x1
        )
        /
        2,

      y:
        pageHeight
        -
        (
          top
          +
          bottom
        )
        /
        2,

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
        PDFLibObj.rgb(
          0,
          0,
          0
        ),

      borderWidth:
        0.9
    }
  );
}


function toUint8Array_(
  signedBytes
) {

  return new Uint8Array(
    signedBytes.map(
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


function toSignedByteArray_(
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
