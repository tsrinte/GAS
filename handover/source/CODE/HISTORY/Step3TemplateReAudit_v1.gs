/**
 * =========================================================
 * STEP 3 Template Re-Audit v1
 *
 * 목적
 * - 사용자가 다시 수정/업로드한 최신 Emerg Template을 새 기준으로 사용
 * - 기존 global ellipse calibration 상태를 폐기
 * - 최신 Template과 마지막 STEP3 Output의 Drawing/Top-Row XML을 비교
 * - 첫 번째 ellipse가 늘어나는 원인을 Shape별 geometry로 확인
 *
 * 전제
 * - BoxAuth.gs / BoxApi.gs / Step3Poc_v6_AsyncPdf.gs가 같은 프로젝트에 존재
 * - BOX_STEP3_TEMPLATE_FILE_ID = 최신 Emerg Template의 Box File ID
 * =========================================================
 */


/**
 * 새 Template 기준으로 이전 Calibration 상태를 정리.
 *
 * Template ID 자체는 지우지 않습니다.
 */
function resetStep3VisualCalibrationForNewTemplate() {

  const props =
    PropertiesService.getScriptProperties();


  [
    'EMERG_PDF_CALIBRATION_STATE_JSON',
    'EMERG_PDF_CALIBRATION_FILES_JSON',
    'EMERG_PDF_ELLIPSE_X_OFFSET_EMU',
    'EMERG_PDF_CALIBRATION_OFFSETS_PX'
  ].forEach(
    function(key) {

      props.deleteProperty(
        key
      );
    }
  );


  console.log(
    'STEP3 Visual Calibration 상태 Reset 완료'
  );

  console.log(
    'BOX_STEP3_TEMPLATE_FILE_ID는 유지됩니다.'
  );
}


/**
 * 최신 Template 단독 Audit.
 */
function runStep3AuditLatestEmergTemplate() {

  const fileId =
    getRequiredProperty_(
      'BOX_STEP3_TEMPLATE_FILE_ID'
    );


  return auditEmergBoxXlsx_(
    fileId,
    'LATEST_TEMPLATE'
  );
}


/**
 * 최신 Template vs 마지막 STEP3 Output 비교.
 *
 * 주의:
 * BOX_STEP3_LAST_OUTPUT_FILE_ID가 이전 Template 기준 파일이면
 * 비교 의미가 없습니다.
 * 새 Template로 runStep3OpenXmlPdfPoc()를 실행한 후 다시 실행하세요.
 */
function runStep3CompareLatestTemplateAndOutput() {

  console.log(
    '=============================='
  );

  console.log(
    '[STEP3 TEMPLATE vs OUTPUT AUDIT] START'
  );

  console.log(
    '=============================='
  );


  const templateId =
    getRequiredProperty_(
      'BOX_STEP3_TEMPLATE_FILE_ID'
    );


  const outputId =
    getRequiredProperty_(
      'BOX_STEP3_LAST_OUTPUT_FILE_ID'
    );


  const template =
    auditEmergBoxXlsx_(
      templateId,
      'TEMPLATE'
    );


  const output =
    auditEmergBoxXlsx_(
      outputId,
      'OUTPUT'
    );


  const drawingSame =
    template.drawingSha256
    ===
    output.drawingSha256;


  const row1Same =
    JSON.stringify(
      template.row1Cells
    )
    ===
    JSON.stringify(
      output.row1Cells
    );


  console.log(
    '------------------------------'
  );

  console.log(
    'Drawing XML Same : '
    +
    drawingSame
  );

  console.log(
    'Row1 Cell Style Same : '
    +
    row1Same
  );

  console.log(
    '------------------------------'
  );


  if (!drawingSame) {

    console.log(
      '주의: Template와 Output의 drawing1.xml이 다릅니다.'
    );

    console.log(
      'Global Calibration/Shape 수정 코드가 적용되었는지 확인하세요.'
    );
  }


  if (!row1Same) {

    console.log(
      '주의: Template와 Output의 Row1 Cell Style 구조가 다릅니다.'
    );

    console.log(
      '상단 검정 Cell 틀의 원인이 생성코드에 있을 가능성이 있습니다.'
    );
  }


  console.log(
    '=============================='
  );

  console.log(
    '[STEP3 TEMPLATE vs OUTPUT AUDIT] END'
  );

  console.log(
    '=============================='
  );


  return {
    drawingSame:
      drawingSame,

    row1Same:
      row1Same,

    template:
      template,

    output:
      output
  };
}


/**
 * Box XLSX Audit
 */
function auditEmergBoxXlsx_(
  fileId,
  label
) {

  const info =
    boxGetFileInfoStep3_(
      fileId
    );


  console.log(
    '=============================='
  );

  console.log(
    '['
    +
    label
    +
    ']'
  );

  console.log(
    'File ID   : '
    +
    info.id
  );

  console.log(
    'File Name : '
    +
    info.name
  );


  const blob =
    boxDownloadFile_(
      fileId
    )
      .copyBlob()
      .setName(
        info.name
      );


  const entries =
    Utilities.unzip(
      asZipBlobForUnzip_(
        blob
      )
    );


  const drawingXml =
    getZipEntryText_(
      entries,
      'xl/drawings/drawing1.xml'
    );


  const sheetXml =
    getZipEntryText_(
      entries,
      'xl/worksheets/sheet1.xml'
    );


  const stylesXml =
    getZipEntryText_(
      entries,
      'xl/styles.xml'
    );


  assertWellFormedXml_(
    drawingXml,
    label
    +
    ' drawing1.xml'
  );


  assertWellFormedXml_(
    sheetXml,
    label
    +
    ' sheet1.xml'
  );


  assertWellFormedXml_(
    stylesXml,
    label
    +
    ' styles.xml'
  );


  const shapes =
    extractEmergEllipseGeometryAudit_(
      drawingXml
    );


  const row1 =
    extractRow1StyleAudit_(
      sheetXml,
      stylesXml
    );


  const sheetView =
    getFirstXmlTagAudit_(
      sheetXml,
      'sheetView'
    );


  const printOptions =
    getFirstXmlTagAudit_(
      sheetXml,
      'printOptions'
    );


  const pageSetup =
    getFirstXmlTagAudit_(
      sheetXml,
      'pageSetup'
    );


  console.log(
    'Ellipse Count : '
    +
    shapes.length
  );


  shapes.forEach(
    function(shape) {

      console.log(
        '[ELLIPSE] '
        +
        shape.descr
        +
        ' | from='
        +
        shape.from
        +
        ' | to='
        +
        shape.to
        +
        ' | cx='
        +
        shape.cx
        +
        ' | cy='
        +
        shape.cy
      );
    }
  );


  const outliers =
    findEllipseSizeOutliersAudit_(
      shapes
    );


  console.log(
    'Ellipse Size Outlier Count : '
    +
    outliers.length
  );


  outliers.forEach(
    function(item) {

      console.log(
        '[OUTLIER] '
        +
        item.descr
        +
        ' | cx='
        +
        item.cx
        +
        ' | cy='
        +
        item.cy
      );
    }
  );


  console.log(
    '[ROW1 STYLES] '
    +
    JSON.stringify(
      row1
    )
  );


  console.log(
    '[sheetView] '
    +
    sheetView
  );


  console.log(
    '[printOptions] '
    +
    printOptions
  );


  console.log(
    '[pageSetup] '
    +
    pageSetup
  );


  return {
    fileId:
      String(
        fileId
      ),

    fileName:
      info.name,

    ellipseCount:
      shapes.length,

    ellipses:
      shapes,

    ellipseOutliers:
      outliers,

    row1Cells:
      row1,

    sheetView:
      sheetView,

    printOptions:
      printOptions,

    pageSetup:
      pageSetup,

    drawingSha256:
      sha256HexStep3_(
        Utilities.newBlob(
          drawingXml
        ).getBytes()
      )
  };
}


/**
 * 28개 ellipse geometry 추출
 *
 * global offset을 더 이상 적용하지 않고
 * 사용자가 Template에서 조정한 Shape 자체를 기준으로 봅니다.
 */
function extractEmergEllipseGeometryAudit_(
  drawingXml
) {

  const result =
    [];


  const anchorRegex =
    /<xdr:twoCellAnchor\b[\s\S]*?<\/xdr:twoCellAnchor>/g;


  const anchors =
    String(
      drawingXml
    ).match(
      anchorRegex
    )
    ||
    [];


  anchors.forEach(
    function(anchorXml) {

      if (
        anchorXml.indexOf(
          'prst="ellipse"'
        )
        ===
        -1
      ) {

        return;
      }


      const descrMatch =
        anchorXml.match(
          /\bdescr="([^"]+)"/
        );


      const descr =
        descrMatch
          ? decodeXmlEntitiesStep3_(
              descrMatch[1]
            )
          : '';


      if (
        !/^(?:職長|作業員[1-6])-/.test(
          descr
        )
      ) {

        return;
      }


      const fromXml =
        extractBetweenAudit_(
          anchorXml,
          '<xdr:from>',
          '</xdr:from>'
        );


      const toXml =
        extractBetweenAudit_(
          anchorXml,
          '<xdr:to>',
          '</xdr:to>'
        );


      const extMatch =
        anchorXml.match(
          /<a:ext\b[^>]*\bcx="(-?\d+)"[^>]*\bcy="(-?\d+)"[^>]*\/>/
        );


      result.push(
        {
          descr:
            descr,

          from:
            parseAnchorPointAudit_(
              fromXml
            ),

          to:
            parseAnchorPointAudit_(
              toXml
            ),

          cx:
            extMatch
              ? Number(
                  extMatch[1]
                )
              : null,

          cy:
            extMatch
              ? Number(
                  extMatch[2]
                )
              : null
        }
      );
    }
  );


  if (
    result.length
    !==
    28
  ) {

    throw new Error(
      'Qualification ellipse가 28개가 아닙니다. actual='
      +
      result.length
    );
  }


  return result;
}


function parseAnchorPointAudit_(
  xml
) {

  if (!xml) {

    return null;
  }


  function num(tag) {

    const match =
      xml.match(
        new RegExp(
          '<xdr:'
          +
          tag
          +
          '>(-?\\d+)<\\/xdr:'
          +
          tag
          +
          '>'
        )
      );


    return match
      ? Number(
          match[1]
        )
      : null;
  }


  return {
    col:
      num(
        'col'
      ),

    colOff:
      num(
        'colOff'
      ),

    row:
      num(
        'row'
      ),

    rowOff:
      num(
        'rowOff'
      )
  };
}


/**
 * Shape 크기 Outlier 검출
 *
 * 동일한 4자격 ellipse는 대체로 비슷한 크기여야 하므로
 * median 대비 ±20% 이상이면 로그에 표시.
 */
function findEllipseSizeOutliersAudit_(
  shapes
) {

  const valid =
    shapes.filter(
      function(item) {

        return (
          Number.isFinite(
            item.cx
          )
          &&
          Number.isFinite(
            item.cy
          )
        );
      }
    );


  if (!valid.length) {

    return [];
  }


  const medianCx =
    medianAudit_(
      valid.map(
        function(item) {

          return item.cx;
        }
      )
    );


  const medianCy =
    medianAudit_(
      valid.map(
        function(item) {

          return item.cy;
        }
      )
    );


  return valid.filter(
    function(item) {

      return (
        Math.abs(
          item.cx
          -
          medianCx
        )
        >
        medianCx
        *
        0.20
        ||
        Math.abs(
          item.cy
          -
          medianCy
        )
        >
        medianCy
        *
        0.20
      );
    }
  );
}


function medianAudit_(
  values
) {

  const sorted =
    values
      .slice()
      .sort(
        function(a, b) {

          return a - b;
        }
      );


  const mid =
    Math.floor(
      sorted.length
      /
      2
    );


  if (
    sorted.length
    %
    2
  ) {

    return sorted[
      mid
    ];
  }


  return (
    sorted[
      mid
      -
      1
    ]
    +
    sorted[
      mid
    ]
  )
  /
  2;
}


/**
 * A1:T1 Cell Style / Fill / Border Audit
 */
function extractRow1StyleAudit_(
  sheetXml,
  stylesXml
) {

  const xfList =
    (
      stylesXml.match(
        /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/
      )
      ||
      [
        '',
        ''
      ]
    )[1]
      .match(
        /<xf\b[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g
      )
    ||
    [];


  const rowMatch =
    sheetXml.match(
      /<row\b[^>]*\br="1"[^>]*>([\s\S]*?)<\/row>/
    );


  const rowXml =
    rowMatch
      ? rowMatch[1]
      : '';


  const result =
    [];


  for (
    let col = 1;
    col <= 20;
    col++
  ) {

    const ref =
      columnNumberToLettersAudit_(
        col
      )
      +
      '1';


    const regex =
      new RegExp(
        '<c\\b[^>]*\\br="'
        +
        ref
        +
        '"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)'
      );


    const match =
      rowXml.match(
        regex
      );


    if (!match) {

      result.push(
        {
          ref:
            ref,

          explicit:
            false,

          styleId:
            null,

          fillId:
            null,

          borderId:
            null
        }
      );

      continue;
    }


    const styleMatch =
      match[0].match(
        /\bs="(\d+)"/
      );


    const styleId =
      styleMatch
        ? Number(
            styleMatch[1]
          )
        : 0;


    const xf =
      xfList[
        styleId
      ]
      ||
      '';


    result.push(
      {
        ref:
          ref,

        explicit:
          true,

        styleId:
          styleId,

        fillId:
          getXmlAttrNumberAudit_(
            xf,
            'fillId'
          ),

        borderId:
          getXmlAttrNumberAudit_(
            xf,
            'borderId'
          )
      }
    );
  }


  return result;
}


function getXmlAttrNumberAudit_(
  xml,
  name
) {

  const match =
    String(
      xml
    ).match(
      new RegExp(
        '\\b'
        +
        name
        +
        '="(\\d+)"'
      )
    );


  return match
    ? Number(
        match[1]
      )
    : null;
}


function getFirstXmlTagAudit_(
  xml,
  tagName
) {

  const match =
    String(
      xml
    ).match(
      new RegExp(
        '<'
        +
        tagName
        +
        '\\b[^>]*(?:\\/?>)'
      )
    );


  return match
    ? match[0]
    : '(none)';
}


function extractBetweenAudit_(
  text,
  start,
  end
) {

  const a =
    text.indexOf(
      start
    );


  if (
    a
    <
    0
  ) {

    return '';
  }


  const b =
    text.indexOf(
      end,
      a
      +
      start.length
    );


  if (
    b
    <
    0
  ) {

    return '';
  }


  return text.substring(
    a
    +
    start.length,
    b
  );
}


function columnNumberToLettersAudit_(
  number
) {

  let value =
    Number(
      number
    );


  let result =
    '';


  while (
    value
    >
    0
  ) {

    value--;


    result =
      String.fromCharCode(
        65
        +
        (
          value
          %
          26
        )
      )
      +
      result;


    value =
      Math.floor(
        value
        /
        26
      );
  }


  return result;
}
