/**
 * =========================================================
 * FINAL Emerg Box PDF Normalization Test v1
 *
 * 목적:
 * Microsoft Excel Print to PDF와 Box PDF Representation의 차이를
 * "실제로 확인된 3가지 XML 차이"만 정규화해서 마지막 1회 검증.
 *
 * 수정 대상은 PDF 변환용 임시 XLSX뿐이며 원본 Template은 변경하지 않음.
 *
 * 실제 확인된 차이:
 * 1) Row1 A1:T1 = empty border인데 applyBorder=1
 *    -> Box에서 검정 Cell outline처럼 렌더링
 * 2) Print_Area = A1:T46 + A47:T78 (union), rowBreaks 없음
 *    -> Box에서 2번째 영역 일부가 1페이지로 올라옴
 * 3) 원본 headerFooter 없음 + sheetView=pageBreakPreview
 *    -> Box PDF에 "Sheet1" 머리글 표시
 *
 * 필요 공통함수:
 * - getRequiredProperty_()
 * - getBoxAuthHeader_()
 * - boxDownloadFile_()
 * - boxUploadFile_()
 *
 * Script Properties:
 * - BOX_STEP3_TEMPLATE_FILE_ID : 최신 Emerg Rev1 Template
 * - BOX_TEST_FOLDER_ID
 * =========================================================
 */


function runFinalEmergBoxNormalizationTest() {

  console.log('==============================');
  console.log('[FINAL BOX NORMALIZATION] START');
  console.log('==============================');


  const templateId =
    getRequiredProperty_(
      'BOX_STEP3_TEMPLATE_FILE_ID'
    );


  const testFolderId =
    getRequiredProperty_(
      'BOX_TEST_FOLDER_ID'
    );


  const sourceInfo =
    normGetBoxFileInfo_(
      templateId
    );


  console.log('[1] Source Template OK');
  console.log('File ID   : ' + sourceInfo.id);
  console.log('File Name : ' + sourceInfo.name);


  const sourceBlob =
    boxDownloadFile_(
      templateId
    )
      .copyBlob()
      .setName(
        sourceInfo.name
      );


  const entries =
    Utilities.unzip(
      sourceBlob
        .copyBlob()
        .setContentType(
          'application/zip'
        )
    );


  let sheetXml =
    normGetZipText_(
      entries,
      'xl/worksheets/sheet1.xml'
    );


  let workbookXml =
    normGetZipText_(
      entries,
      'xl/workbook.xml'
    );


  let stylesXml =
    normGetZipText_(
      entries,
      'xl/styles.xml'
    );


  /*
   * A. Row1 empty-border normalize
   */
  const row1Result =
    normRemoveRow1EmptyAppliedBorder_(
      sheetXml,
      stylesXml
    );


  sheetXml =
    row1Result.sheetXml;


  stylesXml =
    row1Result.stylesXml;


  console.log(
    '[2] Row1 empty-border normalized'
  );

  console.log(
    'Normalized Style IDs : '
    +
    row1Result.styleIds.join(',')
  );


  /*
   * B. Sheet renderer settings normalize
   */
  sheetXml =
    normSheetRendererSettings_(
      sheetXml
    );


  console.log(
    '[3] Sheet view / print options / blank header normalized'
  );


  /*
   * C. Explicit page break after Excel Row 46
   */
  sheetXml =
    normSetManualRowBreak_(
      sheetXml,
      46
    );


  console.log(
    '[4] Manual page break after Row 46 applied'
  );


  /*
   * D. Print Area를 하나의 연속 범위로 변경
   */
  workbookXml =
    normSetSinglePrintArea_(
      workbookXml,
      'Sheet1',
      '$A$1:$T$78'
    );


  console.log(
    '[5] Print Area normalized to A1:T78'
  );


  /*
   * XML Gate
   */
  normAssertXml_(
    sheetXml,
    'sheet1.xml'
  );


  normAssertXml_(
    workbookXml,
    'workbook.xml'
  );


  normAssertXml_(
    stylesXml,
    'styles.xml'
  );


  /*
   * Replace entries
   */
  const outputEntries =
    entries.map(
      function(blob) {

        const name =
          blob.getName();


        if (
          name
          ===
          'xl/worksheets/sheet1.xml'
        ) {

          return Utilities.newBlob(
            sheetXml,
            'application/xml',
            name
          );
        }


        if (
          name
          ===
          'xl/workbook.xml'
        ) {

          return Utilities.newBlob(
            workbookXml,
            'application/xml',
            name
          );
        }


        if (
          name
          ===
          'xl/styles.xml'
        ) {

          return Utilities.newBlob(
            stylesXml,
            'application/xml',
            name
          );
        }


        return blob;
      }
    );


  const time =
    Utilities.formatDate(
      new Date(),
      'Asia/Tokyo',
      'yyyyMMdd_HHmmss'
    );


  const xlsxName =
    'FINAL_NORM_Emerg_'
    +
    time
    +
    '.xlsx';


  const zipBlob =
    Utilities.zip(
      outputEntries,
      xlsxName
    );


  const xlsxBlob =
    zipBlob
      .copyBlob()
      .setName(
        xlsxName
      )
      .setContentType(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );


  const uploadedXlsx =
    boxUploadFile_(
      testFolderId,
      xlsxName,
      xlsxBlob
    );


  console.log(
    '[6] Normalized XLSX Upload OK'
  );

  console.log(
    'Normalized XLSX File ID : '
    +
    uploadedXlsx.id
  );


  PropertiesService
    .getScriptProperties()
    .setProperty(
      'BOX_FINAL_EMERG_NORM_LAST_FILE_ID',
      String(
        uploadedXlsx.id
      )
    );


  /*
   * PDF Representation
   */
  const rep =
    normWaitPdfRep_(
      uploadedXlsx.id,
      240000
    );


  if (!rep) {

    console.log(
      '[7] PDF Representation = PENDING'
    );

    console.log(
      '잠시 후 runFinalEmergBoxNormalizationPdfOnly() 실행'
    );


    return {
      ok: true,
      xlsxReady: true,
      pdfReady: false,
      xlsxFileId: uploadedXlsx.id
    };
  }


  console.log(
    '[7] PDF Representation OK'
  );


  const pdfResult =
    normDownloadPdf_(
      rep
    );


  console.log(
    '[8] PDF Download OK'
  );


  const pdfName =
    'FINAL_NORM_Emerg_'
    +
    time
    +
    '.pdf';


  const uploadedPdf =
    boxUploadFile_(
      testFolderId,
      pdfName,
      pdfResult.blob
        .setName(
          pdfName
        )
    );


  console.log(
    '[9] PDF Upload OK'
  );

  console.log(
    'PDF File ID : '
    +
    uploadedPdf.id
  );


  console.log('==============================');
  console.log('[FINAL BOX NORMALIZATION] RESULT = OK');
  console.log('==============================');


  return {
    ok: true,
    xlsxReady: true,
    pdfReady: true,
    xlsxFileId: uploadedXlsx.id,
    pdfFileId: uploadedPdf.id,
    pdfFileName: pdfName
  };
}


/**
 * PDF pending 시 후속 실행.
 */
function runFinalEmergBoxNormalizationPdfOnly() {

  console.log('==============================');
  console.log('[FINAL BOX NORMALIZATION PDF ONLY] START');
  console.log('==============================');


  const fileId =
    getRequiredProperty_(
      'BOX_FINAL_EMERG_NORM_LAST_FILE_ID'
    );


  const testFolderId =
    getRequiredProperty_(
      'BOX_TEST_FOLDER_ID'
    );


  const rep =
    normWaitPdfRep_(
      fileId,
      240000
    );


  if (!rep) {

    console.log(
      'PDF Representation still pending.'
    );


    return {
      ok: true,
      pdfReady: false,
      xlsxFileId: fileId
    };
  }


  const pdfResult =
    normDownloadPdf_(
      rep
    );


  const time =
    Utilities.formatDate(
      new Date(),
      'Asia/Tokyo',
      'yyyyMMdd_HHmmss'
    );


  const pdfName =
    'FINAL_NORM_Emerg_RESUME_'
    +
    time
    +
    '.pdf';


  const uploadedPdf =
    boxUploadFile_(
      testFolderId,
      pdfName,
      pdfResult.blob
        .setName(
          pdfName
        )
    );


  console.log(
    'PDF File ID : '
    +
    uploadedPdf.id
  );


  console.log('==============================');
  console.log('[FINAL BOX NORMALIZATION PDF ONLY] RESULT = OK');
  console.log('==============================');


  return {
    ok: true,
    pdfReady: true,
    xlsxFileId: fileId,
    pdfFileId: uploadedPdf.id,
    pdfFileName: pdfName
  };
}


/**
 * Row1에서 사용하는 Style ID를 동적으로 찾아
 * borderId=0 + applyBorder 제거.
 *
 * 안전조건:
 * 해당 Style이 Row1 밖에서 사용되면 중단.
 */
function normRemoveRow1EmptyAppliedBorder_(
  sheetXml,
  stylesXml
) {

  const rowMatch =
    sheetXml.match(
      /<row\b[^>]*\br="1"[^>]*>([\s\S]*?)<\/row>/
    );


  if (!rowMatch) {

    throw new Error(
      'Row1을 찾지 못했습니다.'
    );
  }


  const rowXml =
    rowMatch[1];


  const styleIds =
    [];


  const cellRegex =
    /<c\b[^>]*\br="[A-T]1"[^>]*\bs="(\d+)"/g;


  let match =
    null;


  while (
    (
      match =
        cellRegex.exec(
          rowXml
        )
    )
    !==
    null
  ) {

    const styleId =
      Number(
        match[1]
      );


    if (
      styleIds.indexOf(
        styleId
      )
      ===
      -1
    ) {

      styleIds.push(
        styleId
      );
    }
  }


  if (!styleIds.length) {

    throw new Error(
      'Row1 Style ID를 찾지 못했습니다.'
    );
  }


  /*
   * Row1 전용 Style인지 확인.
   */
  styleIds.forEach(
    function(styleId) {

      const regex =
        new RegExp(
          '<c\\b[^>]*\\bs="'
          +
          styleId
          +
          '"[^>]*\\br="([A-Z]+\\d+)"'
          +
          '|'
          +
          '<c\\b[^>]*\\br="([A-Z]+\\d+)"[^>]*\\bs="'
          +
          styleId
          +
          '"',
          'g'
        );


      const refs =
        [];


      let m =
        null;


      while (
        (
          m =
            regex.exec(
              sheetXml
            )
        )
        !==
        null
      ) {

        refs.push(
          m[1]
          ||
          m[2]
        );
      }


      const outside =
        refs.filter(
          function(ref) {

            return (
              !/^[A-T]1$/.test(
                ref
              )
            );
          }
        );


      if (
        outside.length
      ) {

        throw new Error(
          'Row1 Style이 다른 Cell에서도 사용됩니다. style='
          +
          styleId
          +
          ' refs='
          +
          refs.join(',')
        );
      }
    }
  );


  const cellXfsMatch =
    stylesXml.match(
      /<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/
    );


  if (!cellXfsMatch) {

    throw new Error(
      'cellXfs를 찾지 못했습니다.'
    );
  }


  const xfs =
    cellXfsMatch[2].match(
      /<xf\b[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g
    )
    ||
    [];


  styleIds.forEach(
    function(styleId) {

      let xf =
        xfs[
          styleId
        ];


      if (!xf) {

        throw new Error(
          'Style ID 없음: '
          +
          styleId
        );
      }


      /*
       * 실제 Border가 있는 Style을 잘못 없애지 않도록,
       * borderId가 있어도 border XML 자체가 empty인지 확인.
       */
      const borderMatch =
        xf.match(
          /\bborderId="(\d+)"/
        );


      if (!borderMatch) {

        return;
      }


      const borderId =
        Number(
          borderMatch[1]
        );


      if (
        !normIsEmptyBorder_(
          stylesXml,
          borderId
        )
      ) {

        throw new Error(
          'Row1 Style에 실제 Border가 있습니다. style='
          +
          styleId
          +
          ' borderId='
          +
          borderId
        );
      }


      xf =
        xf.replace(
          /\bborderId="\d+"/,
          'borderId="0"'
        );


      xf =
        xf.replace(
          /\s+applyBorder="[^"]*"/g,
          ''
        );


      xfs[
        styleId
      ] =
        xf;
    }
  );


  const rebuilt =
    '<cellXfs'
    +
    cellXfsMatch[1]
    +
    '>'
    +
    xfs.join('')
    +
    '</cellXfs>';


  const updatedStyles =
    stylesXml.replace(
      cellXfsMatch[0],
      rebuilt
    );


  return {
    sheetXml:
      sheetXml,

    stylesXml:
      updatedStyles,

    styleIds:
      styleIds.sort(
        function(a, b) {

          return a - b;
        }
      )
  };
}


function normIsEmptyBorder_(
  stylesXml,
  borderId
) {

  const bordersMatch =
    stylesXml.match(
      /<borders\b[^>]*>([\s\S]*?)<\/borders>/
    );


  if (!bordersMatch) {

    throw new Error(
      'borders를 찾지 못했습니다.'
    );
  }


  const borders =
    bordersMatch[1].match(
      /<border\b[\s\S]*?<\/border>|<border\b[^>]*\/>/g
    )
    ||
    [];


  const border =
    borders[
      borderId
    ];


  if (!border) {

    throw new Error(
      'borderId 없음: '
      +
      borderId
    );
  }


  /*
   * style= 속성이 전혀 없으면 시각적 Border 없음.
   */
  return (
    border.indexOf(
      'style='
    )
    ===
    -1
  );
}


/**
 * Box renderer용 Sheet 설정.
 */
function normSheetRendererSettings_(
  sheetXml
) {

  let xml =
    String(
      sheetXml
    );


  /*
   * pageBreakPreview -> normal
   * gridLines off
   */
  xml =
    xml.replace(
      /<sheetView\b([^>]*)>/,
      function(
        full,
        attrs
      ) {

        let a =
          String(
            attrs
            ||
            ''
          );


        if (
          /\bview="[^"]*"/.test(
            a
          )
        ) {

          a =
            a.replace(
              /\bview="[^"]*"/,
              'view="normal"'
            );
        }

        else {

          a +=
            ' view="normal"';
        }


        if (
          /\bshowGridLines="[^"]*"/.test(
            a
          )
        ) {

          a =
            a.replace(
              /\bshowGridLines="[^"]*"/,
              'showGridLines="0"'
            );
        }

        else {

          a +=
            ' showGridLines="0"';
        }


        return (
          '<sheetView'
          +
          a
          +
          '>'
        );
      }
    );


  /*
   * printOptions는 pageMargins 앞이 schema 순서.
   */
  if (
    /<printOptions\b/.test(
      xml
    )
  ) {

    xml =
      xml.replace(
        /<printOptions\b[^>]*\/>/,
        '<printOptions gridLines="0" gridLinesSet="1" headings="0"/>'
      );
  }

  else {

    xml =
      xml.replace(
        '<pageMargins',
        '<printOptions gridLines="0" gridLinesSet="1" headings="0"/>'
        +
        '<pageMargins'
      );
  }


  /*
   * Box가 자체적으로 Sheet1을 Header처럼 넣는지 확인하기 위해
   * 명시적 빈 Header/Footer 추가.
   *
   * pageSetup 뒤, rowBreaks/drawing 앞.
   */
  xml =
    xml.replace(
      /<headerFooter\b[\s\S]*?<\/headerFooter>/g,
      ''
    );


  const blankHeaderFooter =
    '<headerFooter differentOddEven="0" differentFirst="0">'
    +
    '<oddHeader></oddHeader>'
    +
    '<oddFooter></oddFooter>'
    +
    '<evenHeader></evenHeader>'
    +
    '<evenFooter></evenFooter>'
    +
    '<firstHeader></firstHeader>'
    +
    '<firstFooter></firstFooter>'
    +
    '</headerFooter>';


  xml =
    xml.replace(
      /(<pageSetup\b[^>]*\/>)/,
      '$1'
      +
      blankHeaderFooter
    );


  return xml;
}


/**
 * Excel Row 46 뒤에 명시적 Manual Page Break.
 */
function normSetManualRowBreak_(
  sheetXml,
  rowNumber
) {

  let xml =
    String(
      sheetXml
    );


  xml =
    xml.replace(
      /<rowBreaks\b[\s\S]*?<\/rowBreaks>/g,
      ''
    );


  const rowBreaks =
    '<rowBreaks count="1" manualBreakCount="1">'
    +
    '<brk id="'
    +
    rowNumber
    +
    '" min="0" max="16383" man="1"/>'
    +
    '</rowBreaks>';


  /*
   * headerFooter 다음에 삽입.
   */
  if (
    /<\/headerFooter>/.test(
      xml
    )
  ) {

    xml =
      xml.replace(
        '</headerFooter>',
        '</headerFooter>'
        +
        rowBreaks
      );
  }

  else {

    /*
     * fallback: drawing 앞
     */
    xml =
      xml.replace(
        '<drawing ',
        rowBreaks
        +
        '<drawing '
      );
  }


  return xml;
}


/**
 * Multi-area Print Area -> Single continuous Print Area.
 */
function normSetSinglePrintArea_(
  workbookXml,
  sheetName,
  area
) {

  const value =
    "'"
    +
    sheetName
    +
    "'!"
    +
    area;


  const regex =
    /<definedName\b([^>]*name="_xlnm\.Print_Area"[^>]*)>[\s\S]*?<\/definedName>/;


  if (
    !regex.test(
      workbookXml
    )
  ) {

    throw new Error(
      'Print_Area definedName이 없습니다.'
    );
  }


  return workbookXml.replace(
    regex,
    function(
      full,
      attrs
    ) {

      return (
        '<definedName'
        +
        attrs
        +
        '>'
        +
        value
        +
        '</definedName>'
      );
    }
  );
}


function normAssertXml_(
  xml,
  label
) {

  try {

    XmlService.parse(
      String(
        xml
      )
    );
  }

  catch (error) {

    throw new Error(
      'XML 검증 실패: '
      +
      label
      +
      '\n'
      +
      (
        error
        &&
        error.message
          ? error.message
          : String(error)
      )
    );
  }
}


function normGetBoxFileInfo_(
  fileId
) {

  const response =
    UrlFetchApp.fetch(
      'https://api.box.com/2.0/files/'
      +
      encodeURIComponent(
        fileId
      )
      +
      '?fields=id,name,size,file_version',
      {
        method:
          'get',

        headers:
          getBoxAuthHeader_(),

        muteHttpExceptions:
          true
      }
    );


  if (
    response.getResponseCode()
    !==
    200
  ) {

    throw new Error(
      'Box File Info 실패 HTTP='
      +
      response.getResponseCode()
      +
      '\n'
      +
      response.getContentText()
    );
  }


  return JSON.parse(
    response.getContentText()
  );
}


function normGetZipText_(
  entries,
  name
) {

  for (
    let i = 0;
    i < entries.length;
    i++
  ) {

    if (
      entries[
        i
      ].getName()
      ===
      name
    ) {

      return entries[
        i
      ].getDataAsString(
        'UTF-8'
      );
    }
  }


  throw new Error(
    'ZIP Entry 없음: '
    +
    name
  );
}


function normGetPdfRep_(
  fileId
) {

  const headers =
    getBoxAuthHeader_();


  headers[
    'x-rep-hints'
  ] =
    '[pdf]';


  const response =
    UrlFetchApp.fetch(
      'https://api.box.com/2.0/files/'
      +
      encodeURIComponent(
        fileId
      )
      +
      '?fields=id,name,representations',
      {
        method:
          'get',

        headers:
          headers,

        muteHttpExceptions:
          true
      }
    );


  if (
    response.getResponseCode()
    !==
    200
  ) {

    throw new Error(
      'PDF Representation 조회 실패 HTTP='
      +
      response.getResponseCode()
    );
  }


  const json =
    JSON.parse(
      response.getContentText()
    );


  const reps =
    json.representations
    &&
    json.representations.entries
      ? json.representations.entries
      : [];


  for (
    let i = 0;
    i < reps.length;
    i++
  ) {

    if (
      reps[
        i
      ].representation
      ===
      'pdf'
    ) {

      return reps[
        i
      ];
    }
  }


  return null;
}


function normWaitPdfRep_(
  fileId,
  maxWaitMs
) {

  const start =
    Date.now();


  let attempt =
    0;


  while (
    Date.now()
    -
    start
    <
    Number(
      maxWaitMs
      ||
      240000
    )
  ) {

    attempt++;


    const rep =
      normGetPdfRep_(
        fileId
      );


    const state =
      rep
      &&
      rep.status
      &&
      rep.status.state
        ? String(
            rep.status.state
          )
        : 'none';


    console.log(
      '[PDF REP] Attempt '
      +
      attempt
      +
      ' / state='
      +
      state
    );


    if (
      state
      ===
      'success'
    ) {

      return rep;
    }


    Utilities.sleep(
      5000
    );
  }


  return null;
}


function normDownloadPdf_(
  rep
) {

  const template =
    String(
      rep
        .content
        .url_template
    );


  const candidates =
    [
      '',
      '1.pdf'
    ];


  for (
    let i = 0;
    i < candidates.length;
    i++
  ) {

    const asset =
      candidates[
        i
      ];


    let url =
      template;


    url =
      url.replace(
        /\{\+asset_path\}/gi,
        asset
      );


    url =
      url.replace(
        /%7B%2Basset_path%7D/gi,
        asset
      );


    url =
      url.replace(
        /%7B\+asset_path%7D/gi,
        asset
      );


    const response =
      UrlFetchApp.fetch(
        url,
        {
          method:
            'get',

          headers:
            getBoxAuthHeader_(),

          followRedirects:
            true,

          muteHttpExceptions:
            true
        }
      );


    console.log(
      '[PDF DOWNLOAD] assetPath="'
      +
      asset
      +
      '" / HTTP='
      +
      response.getResponseCode()
    );


    if (
      response.getResponseCode()
      !==
      200
    ) {

      continue;
    }


    const blob =
      response
        .getBlob()
        .setContentType(
          'application/pdf'
        );


    const bytes =
      blob.getBytes();


    if (
      bytes.length
      >=
      4
      &&
      String.fromCharCode(
        bytes[0] & 0xff,
        bytes[1] & 0xff,
        bytes[2] & 0xff,
        bytes[3] & 0xff
      )
      ===
      '%PDF'
    ) {

      return {
        blob:
          blob,

        assetPath:
          asset
      };
    }
  }


  throw new Error(
    'PDF 다운로드 실패'
  );
}
