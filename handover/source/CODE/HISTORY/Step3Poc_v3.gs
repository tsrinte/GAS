/**
 * =========================================================
 * STEP 3 v3
 *
 * XLSX OpenXML 수정
 * → Drawing/Media 보존 검증
 * → Box Upload
 * → Box PDF Representation 검증
 *
 * 수정점:
 * - Utilities.unzip() 호출용 Blob만 application/zip 으로 변환
 * - 출력 XLSX 검증 시에도 ZIP Blob과 XLSX Blob을 분리
 * - Emerg 수정 Template의 ellipse / Alt Text 감사 로그 추가
 * =========================================================
 */

const STEP3_XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const STEP3_ZIP_MIME =
  'application/zip';


function runStep3OpenXmlPdfPoc() {

  console.log('==============================');
  console.log('[STEP 3] START');
  console.log('==============================');

  const sourceFileId =
    getRequiredProperty_(
      'BOX_STEP3_TEMPLATE_FILE_ID'
    );

  const testFolderId =
    getRequiredProperty_(
      'BOX_TEST_FOLDER_ID'
    );


  /*
   * 3-1
   * 원본 파일 정보
   */
  const sourceInfo =
    boxGetFileInfoStep3_(
      sourceFileId
    );

  console.log('[3-1] Source File OK');
  console.log('File ID   : ' + sourceInfo.id);
  console.log('File Name : ' + sourceInfo.name);


  /*
   * 3-2
   * Box에서 XLSX Download
   */
  const sourceBlob =
    boxDownloadFile_(
      sourceFileId
    )
      .copyBlob()
      .setName(
        sourceInfo.name
      );

  console.log('[3-2] XLSX Download OK');


  /*
   * 3-3
   * XLSX는 내부적으로 ZIP이지만,
   * Apps Script Utilities.unzip()은
   * Blob의 Content-Type이 application/zip 이어야 합니다.
   *
   * 원본 XLSX Blob 자체의 MIME은 바꾸지 않고
   * unzip 전용 Copy만 ZIP MIME으로 바꿉니다.
   */
  const sourceZipBlob =
    asZipBlobForUnzip_(
      sourceBlob
    );

  const sourceEntries =
    Utilities.unzip(
      sourceZipBlob
    );

  console.log('[3-3] OpenXML Unzip OK');
  console.log(
    'ZIP Entry Count : '
    +
    sourceEntries.length
  );


  /*
   * 수정 Emerg Template 감사
   */
  const drawingAudit =
    auditEmergDrawingTemplate_(
      sourceEntries
    );

  console.log(
    '[3-3A] Drawing Audit OK'
  );

  console.log(
    'Ellipse Count : '
    +
    drawingAudit.ellipseCount
  );

  console.log(
    'Alt Text Count : '
    +
    drawingAudit.altTextCount
  );


  /*
   * Drawing / Media / worksheet rel 원본 Signature
   */
  const beforeSignature =
    buildOpenXmlPreserveSignature_(
      sourceEntries
    );

  console.log(
    'Preserve Part Count : '
    +
    Object.keys(
      beforeSignature
    ).length
  );


  /*
   * 테스트값
   */
  const marker =
    'STEP3_POC_TEST';


  /*
   * 3-4
   * Emerg E6:H6 병합 영역의 좌상단 E6 수정
   */
  let patchedEntries =
    replaceZipXmlEntry_(
      sourceEntries,
      'xl/worksheets/sheet1.xml',
      function(xml) {

        return replaceExcelCellWithInlineString_(
          xml,
          'E6',
          marker
        );
      }
    );

  console.log(
    '[3-4] E6 OpenXML Patch OK'
  );


  /*
   * 3-5
   * Print Area = A1:T78
   */
  patchedEntries =
    replaceZipXmlEntry_(
      patchedEntries,
      'xl/workbook.xml',
      function(xml) {

        return setStep3PrintArea_(
          xml,
          'Sheet1',
          '$A$1:$T$78',
          0
        );
      }
    );

  console.log(
    '[3-5] Print Area Patch OK'
  );


  /*
   * 3-6
   * ZIP 재압축
   *
   * 중요:
   * zipBlob은 검증용 application/zip 상태로 유지.
   * 실제 Box Upload 직전에 XLSX MIME Copy를 만듭니다.
   */
  const time =
    Utilities.formatDate(
      new Date(),
      'Asia/Tokyo',
      'yyyyMMdd_HHmmss'
    );

  const outputName =
    'STEP3_Emerg_POC_'
    +
    time
    +
    '.xlsx';

  const zipBlob =
    Utilities
      .zip(
        patchedEntries,
        outputName
      )
      .setName(
        outputName
      );

  console.log(
    '[3-6] XLSX ZIP Repack OK'
  );


  /*
   * 3-7
   * 재압축 결과 검증
   */
  const verifyEntries =
    Utilities.unzip(
      asZipBlobForUnzip_(
        zipBlob
      )
    );


  const sheetXml =
    getZipEntryText_(
      verifyEntries,
      'xl/worksheets/sheet1.xml'
    );

  if (
    sheetXml.indexOf(marker)
    ===
    -1
  ) {

    throw new Error(
      '재압축 후 E6 테스트값을 찾지 못했습니다.'
    );
  }


  const workbookXml =
    getZipEntryText_(
      verifyEntries,
      'xl/workbook.xml'
    );

  if (
    workbookXml.indexOf(
      '$A$1:$T$78'
    )
    ===
    -1
  ) {

    throw new Error(
      '재압축 후 Print Area를 찾지 못했습니다.'
    );
  }

  console.log(
    '[3-7] OpenXML Content Verify OK'
  );


  /*
   * Drawing / Media 변조 여부
   */
  const afterSignature =
    buildOpenXmlPreserveSignature_(
      verifyEntries
    );

  assertOpenXmlSignatureSame_(
    beforeSignature,
    afterSignature
  );

  console.log(
    '[3-8] Drawing / Media Preserve OK'
  );


  /*
   * 출력 ZIP을 실제 XLSX MIME으로 복사
   */
  const outputBlob =
    zipBlob
      .copyBlob()
      .setName(
        outputName
      )
      .setContentType(
        STEP3_XLSX_MIME
      );


  /*
   * 3-9
   * 수정 XLSX Box Upload
   */
  const uploadedXlsx =
    boxUploadFile_(
      testFolderId,
      outputName,
      outputBlob
    );

  console.log(
    '[3-9] Modified XLSX Upload OK'
  );

  console.log(
    'Output File ID : '
    +
    uploadedXlsx.id
  );

  PropertiesService
    .getScriptProperties()
    .setProperty(
      'BOX_STEP3_LAST_OUTPUT_FILE_ID',
      String(uploadedXlsx.id)
    );


  /*
   * 3-10
   * Box PDF Representation
   */
  const pdfRep =
    boxWaitForPdfRepresentation_(
      uploadedXlsx.id
    );

  console.log(
    '[3-10] PDF Representation OK'
  );


  /*
   * 첫 페이지 PDF 다운로드
   */
  const page1Blob =
    boxDownloadPdfRepresentationPageByFileId_(
      uploadedXlsx.id,
      1
    );

  const page1Name =
    'STEP3_Emerg_POC_'
    +
    time
    +
    '_page1.pdf';

  const uploadedPdf =
    boxUploadFile_(
      testFolderId,
      page1Name,
      page1Blob.setName(page1Name)
    );

  console.log(
    '[3-11] PDF Page1 Upload OK'
  );

  console.log(
    'PDF File ID : '
    +
    uploadedPdf.id
  );


  console.log(
    '=============================='
  );

  console.log(
    '[STEP 3-A] TECHNICAL RESULT = OK'
  );

  console.log(
    '=============================='
  );


  return {
    ok: true,

    sourceFileId:
      sourceFileId,

    modifiedXlsxId:
      uploadedXlsx.id,

    modifiedXlsxName:
      outputName,

    pdfPage1Id:
      uploadedPdf.id,

    pdfPage1Name:
      page1Name,

    marker:
      marker,

    printArea:
      'A1:T78',

    ellipseCount:
      drawingAudit.ellipseCount,

    altTextCount:
      drawingAudit.altTextCount,

    preservedOpenXmlParts:
      Object.keys(
        afterSignature
      ).length
  };
}


/**
 * unzip() 전용 ZIP MIME Copy
 *
 * XLSX/XLSM은 ZIP container이지만 MIME은 Excel이므로
 * Utilities.unzip() 직전에만 application/zip으로 바꿉니다.
 */
function asZipBlobForUnzip_(
  blob
) {

  return blob
    .copyBlob()
    .setContentType(
      STEP3_ZIP_MIME
    );
}


/**
 * Emerg Drawing Audit
 *
 * 수정 Template:
 * - 職長 4개
 * - 作業員1~6 각 4개
 * = ellipse 28개
 *
 * Alt Text도 28개를 기대합니다.
 */
function auditEmergDrawingTemplate_(
  entries
) {

  const xml =
    getZipEntryText_(
      entries,
      'xl/drawings/drawing1.xml'
    );

  const ellipseCount =
    (
      xml.match(
        /prst="ellipse"/g
      )
      ||
      []
    ).length;

  const altTexts =
    [];

  const descrRegex =
    /\bdescr="([^"]+)"/g;

  let match = null;

  while (
    (
      match =
        descrRegex.exec(xml)
    )
    !==
    null
  ) {

    altTexts.push(
      decodeXmlEntitiesStep3_(
        match[1]
      )
    );
  }


  if (
    ellipseCount
    !==
    28
  ) {

    throw new Error(
      'Emerg ellipse 수가 28개가 아닙니다. actual='
      +
      ellipseCount
    );
  }


  if (
    altTexts.length
    !==
    28
  ) {

    throw new Error(
      'Emerg ellipse Alt Text 수가 28개가 아닙니다. actual='
      +
      altTexts.length
    );
  }


  return {
    ellipseCount:
      ellipseCount,

    altTextCount:
      altTexts.length,

    altTexts:
      altTexts
  };
}


/**
 * Box File Info
 */
function boxGetFileInfoStep3_(fileId) {

  const url =
    'https://api.box.com/2.0/files/'
    +
    encodeURIComponent(fileId)
    +
    '?fields=id,name,size,file_version';


  const response =
    UrlFetchApp.fetch(
      url,
      {
        method: 'get',

        headers:
          getBoxAuthHeader_(),

        muteHttpExceptions:
          true
      }
    );


  const status =
    response.getResponseCode();


  if (status !== 200) {

    throw new Error(
      'Box File Info 실패'
      +
      '\nHTTP='
      +
      status
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


/**
 * ZIP 내부 XML 하나 변경
 */
function replaceZipXmlEntry_(
  entries,
  targetName,
  transform
) {

  let found =
    false;


  const result =
    entries.map(
      function(blob) {

        if (
          blob.getName()
          !==
          targetName
        ) {

          return blob;
        }


        found =
          true;


        const sourceXml =
          blob.getDataAsString(
            'UTF-8'
          );


        const outputXml =
          transform(
            sourceXml
          );


        return Utilities.newBlob(
          outputXml,
          'application/xml',
          targetName
        );
      }
    );


  if (!found) {

    throw new Error(
      'OpenXML Entry가 없습니다: '
      +
      targetName
    );
  }


  return result;
}


/**
 * Excel Cell을 Inline String으로 교체
 *
 * 기존 Cell의 r/s 등 속성은 유지하고,
 * 기존 t 속성만 제거 후 inlineStr로 변경.
 */
function replaceExcelCellWithInlineString_(
  xml,
  cellRef,
  value
) {

  const ref =
    escapeRegexStep3_(
      cellRef
    );


  const fullCellRegex =
    new RegExp(
      '<c\\b([^>]*\\br="'
      +
      ref
      +
      '"[^>]*)>'
      +
      '[\\s\\S]*?'
      +
      '<\\/c>'
    );


  const selfClosingRegex =
    new RegExp(
      '<c\\b([^>]*\\br="'
      +
      ref
      +
      '"[^>]*)\\/>'
    );


  const escapedValue =
    escapeXmlStep3_(
      value
    );


  let match =
    xml.match(
      fullCellRegex
    );


  let regex =
    fullCellRegex;


  if (!match) {

    match =
      xml.match(
        selfClosingRegex
      );

    regex =
      selfClosingRegex;
  }


  if (!match) {

    throw new Error(
      '대상 Cell을 찾지 못했습니다: '
      +
      cellRef
    );
  }


  const attrs =
    String(
      match[1]
      ||
      ''
    )
      .replace(
        /\s+t="[^"]*"/g,
        ''
      );


  const replacement =
    '<c'
    +
    attrs
    +
    ' t="inlineStr">'
    +
    '<is>'
    +
    '<t xml:space="preserve">'
    +
    escapedValue
    +
    '</t>'
    +
    '</is>'
    +
    '</c>';


  return xml.replace(
    regex,
    replacement
  );
}


/**
 * Workbook Print Area 설정
 */
function setStep3PrintArea_(
  workbookXml,
  sheetName,
  area,
  localSheetId
) {

  const printAreaText =
    "'"
    +
    sheetName
    +
    "'!"
    +
    area;


  const definedName =
    '<definedName '
    +
    'name="_xlnm.Print_Area" '
    +
    'localSheetId="'
    +
    localSheetId
    +
    '">'
    +
    printAreaText
    +
    '</definedName>';


  const existingRegex =
    new RegExp(
      '<definedName\\b'
      +
      '[^>]*name="_xlnm\\.Print_Area"'
      +
      '[^>]*localSheetId="'
      +
      localSheetId
      +
      '"'
      +
      '[^>]*>'
      +
      '[\\s\\S]*?'
      +
      '<\\/definedName>'
    );


  if (
    existingRegex.test(
      workbookXml
    )
  ) {

    return workbookXml.replace(
      existingRegex,
      definedName
    );
  }


  if (
    workbookXml.indexOf(
      '<definedNames>'
    )
    !==
    -1
  ) {

    return workbookXml.replace(
      '</definedNames>',
      definedName
      +
      '</definedNames>'
    );
  }


  return workbookXml.replace(
    '</workbook>',
    '<definedNames>'
    +
    definedName
    +
    '</definedNames>'
    +
    '</workbook>'
  );
}


/**
 * Shape / Media / worksheet rel Signature
 */
function buildOpenXmlPreserveSignature_(
  entries
) {

  const result =
    {};


  entries.forEach(
    function(blob) {

      const name =
        blob.getName();


      const preserve =
        name.indexOf(
          'xl/drawings/'
        )
        ===
        0

        ||

        name.indexOf(
          'xl/media/'
        )
        ===
        0

        ||

        name.indexOf(
          'xl/worksheets/_rels/'
        )
        ===
        0;


      if (!preserve) {
        return;
      }


      result[name] =
        sha256HexStep3_(
          blob.getBytes()
        );
    }
  );


  return result;
}


/**
 * Signature 비교
 */
function assertOpenXmlSignatureSame_(
  before,
  after
) {

  const beforeNames =
    Object.keys(before)
      .sort();


  const afterNames =
    Object.keys(after)
      .sort();


  if (
    JSON.stringify(beforeNames)
    !==
    JSON.stringify(afterNames)
  ) {

    throw new Error(
      'Drawing/Media Entry 목록이 변경되었습니다.'
    );
  }


  beforeNames.forEach(
    function(name) {

      if (
        before[name]
        !==
        after[name]
      ) {

        throw new Error(
          'OpenXML Drawing/Media가 변경되었습니다: '
          +
          name
        );
      }
    }
  );
}


/**
 * ZIP Entry 문자열 취득
 */
function getZipEntryText_(
  entries,
  targetName
) {

  for (
    let i = 0;
    i < entries.length;
    i++
  ) {

    if (
      entries[i].getName()
      ===
      targetName
    ) {

      return entries[i]
        .getDataAsString(
          'UTF-8'
        );
    }
  }


  throw new Error(
    'ZIP Entry 없음: '
    +
    targetName
  );
}


/**
 * PDF Representation 대기
 */
function boxWaitForPdfRepresentation_(
  fileId
) {

  const maxAttempt =
    12;


  for (
    let attempt = 1;
    attempt <= maxAttempt;
    attempt++
  ) {

    const rep =
      boxGetPdfRepresentation_(
        fileId
      );


    if (rep) {

      const state =
        rep.status
        &&
        rep.status.state
          ? rep.status.state
          : 'unknown';


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


      if (
        state
        !==
        'pending'
        &&
        state
        !==
        'none'
        &&
        state
        !==
        'viewable'
      ) {

        throw new Error(
          '예상하지 못한 PDF Representation 상태: '
          +
          state
        );
      }
    }


    Utilities.sleep(
      3000
    );
  }


  throw new Error(
    'Box PDF Representation이 제한시간 내 success가 되지 않았습니다.'
  );
}


/**
 * PDF Representation 조회
 */
function boxGetPdfRepresentation_(
  fileId
) {

  const headers =
    getBoxAuthHeader_();


  headers['x-rep-hints'] =
    '[pdf]';


  const response =
    UrlFetchApp.fetch(
      'https://api.box.com/2.0/files/'
      +
      encodeURIComponent(fileId)
      +
      '?fields=id,name,representations',
      {
        method: 'get',

        headers:
          headers,

        muteHttpExceptions:
          true
      }
    );


  const status =
    response.getResponseCode();


  if (status !== 200) {

    throw new Error(
      'PDF Representation 조회 실패'
      +
      '\nHTTP='
      +
      status
      +
      '\n'
      +
      response.getContentText()
    );
  }


  const json =
    JSON.parse(
      response.getContentText()
    );


  const entries =
    json.representations
    &&
    json.representations.entries
      ? json.representations.entries
      : [];


  for (
    let i = 0;
    i < entries.length;
    i++
  ) {

    if (
      entries[i].representation
      ===
      'pdf'
    ) {

      return entries[i];
    }
  }


  return null;
}


/**
 * PDF Representation URL template의 {+asset_path}를 안전하게 확장.
 *
 * Box 문서상 url_template은 opaque URL이므로
 * 구조를 재조립하지 않고 placeholder만 치환합니다.
 * 일부 클라이언트/직렬화 환경에서 + 또는 {}가 percent-encoding될 수 있어
 * raw/encoded 패턴을 모두 처리합니다.
 */
function expandBoxRepresentationUrl_(
  urlTemplate,
  assetPath
) {

  const template =
    String(
      urlTemplate
      ||
      ''
    );


  if (!template) {

    throw new Error(
      'PDF Representation url_template이 비어 있습니다.'
    );
  }


  let url =
    template;


  /*
   * 공식 형태
   * {+asset_path}
   */
  url =
    url.replace(
      /\{\+asset_path\}/gi,
      assetPath
    );


  /*
   * percent encoded 형태
   * %7B%2Basset_path%7D
   */
  url =
    url.replace(
      /%7B%2Basset_path%7D/gi,
      assetPath
    );


  /*
   * 일부 환경에서 +만 literal로 남는 형태
   * %7B+asset_path%7D
   */
  url =
    url.replace(
      /%7B\+asset_path%7D/gi,
      assetPath
    );


  if (
    url === template
    ||
    /asset_path/i.test(url)
  ) {

    throw new Error(
      'Box PDF url_template의 asset_path 치환에 실패했습니다.'
    );
  }


  return url;
}


/**
 * PDF Representation 페이지 다운로드
 *
 * status=success 직후에도 실제 asset이 잠깐 404를 반환할 수 있는 경우를 고려해
 * representation 정보를 매 회 새로 조회하고 404/202를 재시도합니다.
 */
function boxDownloadPdfRepresentationPageByFileId_(
  fileId,
  page
) {

  const maxAttempt =
    8;

  const assetPath =
    String(page)
    +
    '.pdf';


  for (
    let attempt = 1;
    attempt <= maxAttempt;
    attempt++
  ) {

    const representation =
      boxGetPdfRepresentation_(
        fileId
      );


    if (
      !representation
      ||
      !representation.content
      ||
      !representation.content.url_template
    ) {

      console.log(
        '[PDF DOWNLOAD] Attempt '
        +
        attempt
        +
        ' / representation URL not ready'
      );

      Utilities.sleep(
        2500
      );

      continue;
    }


    const state =
      representation.status
      &&
      representation.status.state
        ? String(
            representation.status.state
          )
        : 'unknown';


    const url =
      expandBoxRepresentationUrl_(
        representation
          .content
          .url_template,
        assetPath
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


    const status =
      response.getResponseCode();


    console.log(
      '[PDF DOWNLOAD] Attempt '
      +
      attempt
      +
      ' / repState='
      +
      state
      +
      ' / HTTP='
      +
      status
    );


    if (
      status
      ===
      200
    ) {

      const blob =
        response
          .getBlob()
          .setContentType(
            'application/pdf'
          );


      /*
       * 정상 PDF Signature까지 확인
       */
      const bytes =
        blob.getBytes();


      if (
        bytes.length < 5
        ||
        String.fromCharCode(
          bytes[0] & 0xff,
          bytes[1] & 0xff,
          bytes[2] & 0xff,
          bytes[3] & 0xff
        )
        !==
        '%PDF'
      ) {

        throw new Error(
          'HTTP 200이지만 응답이 PDF 파일이 아닙니다.'
        );
      }


      return blob;
    }


    /*
     * Representation success와 실제 asset 배포 사이의 짧은 지연 대응
     */
    if (
      status
      ===
      404
      ||
      status
      ===
      202
    ) {

      Utilities.sleep(
        3000
      );

      continue;
    }


    throw new Error(
      'PDF Representation 다운로드 실패'
      +
      '\nPage='
      +
      page
      +
      '\nHTTP='
      +
      status
      +
      '\nBody='
      +
      response
        .getContentText()
        .substring(
          0,
          500
        )
    );
  }


  throw new Error(
    'PDF Representation page '
    +
    page
    +
    ' 다운로드가 재시도 후에도 완료되지 않았습니다.'
  );
}


/**
 * 기존 호출명 호환용 Wrapper
 */
function boxDownloadPdfRepresentationPage_(
  representation,
  page
) {

  if (
    !representation
    ||
    !representation.content
    ||
    !representation.content.url_template
  ) {

    throw new Error(
      'PDF Representation URL이 없습니다.'
    );
  }


  const url =
    expandBoxRepresentationUrl_(
      representation
        .content
        .url_template,
      String(page) + '.pdf'
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


  const status =
    response.getResponseCode();


  if (
    status !== 200
  ) {

    throw new Error(
      'PDF Representation 다운로드 실패'
      +
      '\nPage='
      +
      page
      +
      '\nHTTP='
      +
      status
    );
  }


  return response
    .getBlob()
    .setContentType(
      'application/pdf'
    );
}


/**
 * 이미 업로드된 마지막 STEP3 XLSX에 대해
 * PDF Representation 다운로드 부분만 재시험.
 *
 * 전체 OpenXML 처리를 다시 하지 않고 다운로드 이슈만 분리 검증할 때 사용.
 */
function runStep3PdfOnlyRetry() {

  console.log(
    '=============================='
  );

  console.log(
    '[STEP 3-PDF RETRY] START'
  );

  console.log(
    '=============================='
  );


  const fileId =
    getRequiredProperty_(
      'BOX_STEP3_LAST_OUTPUT_FILE_ID'
    );


  const testFolderId =
    getRequiredProperty_(
      'BOX_TEST_FOLDER_ID'
    );


  const rep =
    boxWaitForPdfRepresentation_(
      fileId
    );


  console.log(
    '[R-1] PDF Representation OK'
  );


  const page1Blob =
    boxDownloadPdfRepresentationPageByFileId_(
      fileId,
      1
    );


  console.log(
    '[R-2] PDF Page1 Download OK'
  );


  const time =
    Utilities.formatDate(
      new Date(),
      'Asia/Tokyo',
      'yyyyMMdd_HHmmss'
    );


  const page1Name =
    'STEP3_Emerg_POC_RETRY_'
    +
    time
    +
    '_page1.pdf';


  const uploadedPdf =
    boxUploadFile_(
      testFolderId,
      page1Name,
      page1Blob
        .setName(
          page1Name
        )
    );


  console.log(
    '[R-3] PDF Page1 Upload OK'
  );

  console.log(
    'PDF File ID : '
    +
    uploadedPdf.id
  );


  console.log(
    '=============================='
  );

  console.log(
    '[STEP 3-PDF RETRY] RESULT = OK'
  );

  console.log(
    '=============================='
  );


  return {
    ok:
      true,

    sourceXlsxId:
      fileId,

    pdfFileId:
      uploadedPdf.id,

    pdfFileName:
      page1Name
  };
}


/**
 * SHA256
 */
function sha256HexStep3_(
  bytes
) {

  return Utilities
    .computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      bytes
    )
    .map(
      function(byte) {

        const value =
          (
            byte
            +
            256
          )
          %
          256;


        return (
          '0'
          +
          value.toString(16)
        ).slice(-2);
      }
    )
    .join('');
}


/**
 * XML Escape
 */
function escapeXmlStep3_(
  value
) {

  return String(
    value == null
      ? ''
      : value
  )
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


/**
 * XML Entity Decode (Alt Text 감사용)
 */
function decodeXmlEntitiesStep3_(
  value
) {

  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}


/**
 * Regex Escape
 */
function escapeRegexStep3_(
  value
) {

  return String(value)
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );
}
