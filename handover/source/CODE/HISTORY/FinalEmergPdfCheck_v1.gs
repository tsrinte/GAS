/**
 * =========================================================
 * FINAL Emerg PDF Renderer Check
 *
 * 목적
 * - 최신 Emerg Template 자체를 수정하지 않고 Box PDF Representation만 검증
 * - OpenXML Writer / Shape 삭제 / Calibration 없음
 * - 새 Cell 기반 Template의 Box Renderer 결과만 분리 확인
 *
 * 필요:
 * - Config.gs          : getRequiredProperty_()
 * - BoxAuth.gs         : getBoxService_()
 * - BoxApi.gs          : boxDownloadFile_(), boxUploadFile_(), getBoxAuthHeader_()
 *
 * Script Properties:
 * - BOX_STEP3_TEMPLATE_FILE_ID : 최신 Emerg Rev1(1)의 Box File ID
 * - BOX_TEST_FOLDER_ID         : Checklist_GAS_TEST Folder ID
 * =========================================================
 */


/**
 * 메인 실행 함수
 */
function runFinalEmergPdfCheck() {

  console.log(
    '=============================='
  );

  console.log(
    '[FINAL EMERG PDF CHECK] START'
  );

  console.log(
    '=============================='
  );


  const templateFileId =
    getRequiredProperty_(
      'BOX_STEP3_TEMPLATE_FILE_ID'
    );


  const testFolderId =
    getRequiredProperty_(
      'BOX_TEST_FOLDER_ID'
    );


  /*
   * 1. 최신 Template 정보
   */
  const fileInfo =
    finalEmergPdfGetFileInfo_(
      templateFileId
    );


  console.log(
    '[1] Template File OK'
  );

  console.log(
    'File ID   : '
    +
    fileInfo.id
  );

  console.log(
    'File Name : '
    +
    fileInfo.name
  );


  /*
   * 2. Template 자체 구조 Audit
   */
  const templateBlob =
    boxDownloadFile_(
      templateFileId
    )
      .copyBlob()
      .setName(
        fileInfo.name
      );


  const zipBlob =
    templateBlob
      .copyBlob()
      .setContentType(
        'application/zip'
      );


  const entries =
    Utilities.unzip(
      zipBlob
    );


  const audit =
    finalEmergPdfAuditTemplate_(
      entries
    );


  console.log(
    '[2] Template Audit OK'
  );

  console.log(
    'Ellipse Total      : '
    +
    audit.ellipseTotal
  );

  console.log(
    'oneCellAnchor      : '
    +
    audit.oneCellEllipseCount
  );

  console.log(
    'Front Qualification: '
    +
    audit.frontQualificationCount
  );

  console.log(
    'Long-term Leader   : '
    +
    audit.longTermLeaderCount
  );

  console.log(
    'Orientation        : '
    +
    audit.orientation
  );

  console.log(
    'Print Area         : '
    +
    audit.printArea
  );


  /*
   * 3. Box PDF Representation 대기
   */
  const representation =
    finalEmergPdfWaitRepresentation_(
      templateFileId,
      240000
    );


  if (!representation) {

    console.log(
      '[3] PDF Representation still PENDING'
    );

    console.log(
      '잠시 후 같은 함수를 다시 실행하세요.'
    );


    return {
      ok:
        true,

      templateAuditOk:
        true,

      pdfReady:
        false,

      fileId:
        templateFileId
    };
  }


  console.log(
    '[3] PDF Representation OK'
  );


  /*
   * 4. PDF Download
   */
  const pdfResult =
    finalEmergPdfDownloadRepresentation_(
      representation
    );


  console.log(
    '[4] PDF Download OK'
  );

  console.log(
    'assetPath='
    +
    (
      pdfResult.assetPath
      ||
      '(empty)'
    )
  );


  /*
   * 5. TEST Folder에 PDF 저장
   */
  const time =
    Utilities.formatDate(
      new Date(),
      'Asia/Tokyo',
      'yyyyMMdd_HHmmss'
    );


  const pdfName =
    'FINALCHECK_Emerg_Rev1_'
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
    '[5] PDF Upload OK'
  );

  console.log(
    'PDF File ID   : '
    +
    uploadedPdf.id
  );

  console.log(
    'PDF File Name : '
    +
    pdfName
  );


  console.log(
    '=============================='
  );

  console.log(
    '[FINAL EMERG PDF CHECK] RESULT = OK'
  );

  console.log(
    '=============================='
  );


  return {
    ok:
      true,

    templateAuditOk:
      true,

    pdfReady:
      true,

    templateFileId:
      templateFileId,

    pdfFileId:
      uploadedPdf.id,

    pdfFileName:
      pdfName,

    audit:
      audit
  };
}


/**
 * Box File Info
 */
function finalEmergPdfGetFileInfo_(
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


  const status =
    response.getResponseCode();


  if (
    status
    !==
    200
  ) {

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
 * 최신 Template 구조 Audit
 *
 * Rev1 기대값:
 * - Ellipse 총 32
 * - 32개 모두 oneCellAnchor
 * - Front = 職長4 + 作業者1~6×4 = 28
 * - 장기화 Section 職長 = 4
 *
 * Shape Name은 중복되어 사용하지 않음.
 * Alt Text(cNvPr descr)만 논리 ID로 사용.
 */
function finalEmergPdfAuditTemplate_(
  entries
) {

  const drawingXml =
    finalEmergGetZipText_(
      entries,
      'xl/drawings/drawing1.xml'
    );


  const sheetXml =
    finalEmergGetZipText_(
      entries,
      'xl/worksheets/sheet1.xml'
    );


  const workbookXml =
    finalEmergGetZipText_(
      entries,
      'xl/workbook.xml'
    );


  const oneCellBlocks =
    drawingXml.match(
      /<xdr:oneCellAnchor\b[\s\S]*?<\/xdr:oneCellAnchor>/g
    )
    ||
    [];


  const ellipseBlocks =
    oneCellBlocks.filter(
      function(block) {

        return (
          block.indexOf(
            'prst="ellipse"'
          )
          !==
          -1
        );
      }
    );


  const ellipseTotal =
    (
      drawingXml.match(
        /prst="ellipse"/g
      )
      ||
      []
    ).length;


  if (
    ellipseTotal
    !==
    32
  ) {

    throw new Error(
      '최신 Emerg Template의 ellipse 수가 32개가 아닙니다. actual='
      +
      ellipseTotal
    );
  }


  if (
    ellipseBlocks.length
    !==
    32
  ) {

    throw new Error(
      '32개 ellipse 모두 oneCellAnchor여야 합니다. actual='
      +
      ellipseBlocks.length
    );
  }


  const rows =
    [];


  const descrCounts =
    {};


  ellipseBlocks.forEach(
    function(block) {

      const descrMatch =
        block.match(
          /\bdescr="([^"]+)"/
        );


      if (!descrMatch) {

        throw new Error(
          'Alt Text/descr가 없는 ellipse가 있습니다.'
        );
      }


      const descr =
        finalEmergDecodeXml_(
          descrMatch[1]
        );


      descrCounts[
        descr
      ] =
        (
          descrCounts[
            descr
          ]
          ||
          0
        )
        +
        1;


      const rowMatch =
        block.match(
          /<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/
        );


      if (!rowMatch) {

        throw new Error(
          'ellipse anchor row를 읽을 수 없습니다: '
          +
          descr
        );
      }


      rows.push(
        {
          descr:
            descr,

          row:
            Number(
              rowMatch[1]
            )
        }
      );
    }
  );


  /*
   * 作業者1~6 각 자격 ID는 정확히 1개
   */
  const qualifications =
    [
      '安衛法60条',
      '職長',
      '電気',
      'ガス'
    ];


  for (
    let worker = 1;
    worker <= 6;
    worker++
  ) {

    qualifications.forEach(
      function(qualification) {

        const key =
          '作業者'
          +
          worker
          +
          '-'
          +
          qualification;


        if (
          descrCounts[
            key
          ]
          !==
          1
        ) {

          throw new Error(
            key
            +
            ' ellipse count expected=1 actual='
            +
            (
              descrCounts[
                key
              ]
              ||
              0
            )
          );
        }
      }
    );
  }


  /*
   * 職長 자격 ID는 Front + 장기화 Section = 각각 2개
   */
  qualifications.forEach(
    function(qualification) {

      const key =
        '職長-'
        +
        qualification;


      if (
        descrCounts[
          key
        ]
        !==
        2
      ) {

        throw new Error(
          key
          +
          ' ellipse count expected=2 actual='
          +
          (
            descrCounts[
              key
            ]
            ||
            0
          )
        );
      }
    }
  );


  const frontQualificationCount =
    rows.filter(
      function(item) {

        /*
         * zero-based row 6~8 = Excel row 7~9
         */
        return (
          item.row
          >=
          6
          &&
          item.row
          <=
          8
        );
      }
    ).length;


  const longTermLeaderCount =
    rows.filter(
      function(item) {

        /*
         * zero-based row 50 = Excel row 51
         */
        return (
          item.row
          ===
          50
        );
      }
    ).length;


  if (
    frontQualificationCount
    !==
    28
  ) {

    throw new Error(
      'Front qualification ellipse expected=28 actual='
      +
      frontQualificationCount
    );
  }


  if (
    longTermLeaderCount
    !==
    4
  ) {

    throw new Error(
      'Long-term leader ellipse expected=4 actual='
      +
      longTermLeaderCount
    );
  }


  const pageSetupMatch =
    sheetXml.match(
      /<pageSetup\b([^>]*)\/>/
    );


  const orientationMatch =
    pageSetupMatch
      ? pageSetupMatch[0].match(
          /\borientation="([^"]+)"/
        )
      : null;


  const orientation =
    orientationMatch
      ? orientationMatch[1]
      : '(none)';


  if (
    orientation
    !==
    'landscape'
  ) {

    throw new Error(
      'Emerg orientation이 landscape가 아닙니다: '
      +
      orientation
    );
  }


  const printAreaMatch =
    workbookXml.match(
      /<definedName\b[^>]*name="_xlnm\.Print_Area"[^>]*>([\s\S]*?)<\/definedName>/
    );


  const printArea =
    printAreaMatch
      ? finalEmergDecodeXml_(
          printAreaMatch[1]
        )
      : '(none)';


  return {
    ellipseTotal:
      ellipseTotal,

    oneCellEllipseCount:
      ellipseBlocks.length,

    frontQualificationCount:
      frontQualificationCount,

    longTermLeaderCount:
      longTermLeaderCount,

    orientation:
      orientation,

    printArea:
      printArea
  };
}


/**
 * PDF Representation 상태 확인
 */
function finalEmergPdfGetRepresentation_(
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


  const status =
    response.getResponseCode();


  if (
    status
    !==
    200
  ) {

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
      entries[
        i
      ].representation
      ===
      'pdf'
    ) {

      return entries[
        i
      ];
    }
  }


  return null;
}


/**
 * 최대 대기시간 동안 PDF Representation success 대기.
 * timeout이어도 Error가 아니라 null 반환.
 */
function finalEmergPdfWaitRepresentation_(
  fileId,
  maxWaitMs
) {

  const started =
    Date.now();


  let attempt =
    0;


  while (
    Date.now()
    -
    started
    <
    Number(
      maxWaitMs
      ||
      240000
    )
  ) {

    attempt++;


    const rep =
      finalEmergPdfGetRepresentation_(
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


    Utilities.sleep(
      5000
    );
  }


  return null;
}


/**
 * PDF Representation 다운로드
 *
 * 현재 사내 Box에서 XLSX PDF representation은
 * properties={} + empty assetPath 방식이 확인되어 있으므로
 * empty를 먼저 시험하고, 실패하면 1.pdf를 fallback.
 */
function finalEmergPdfDownloadRepresentation_(
  representation
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


  const template =
    String(
      representation
        .content
        .url_template
    );


  const candidates =
    [
      '',
      '1.pdf'
    ];


  const errors =
    [];


  for (
    let i = 0;
    i < candidates.length;
    i++
  ) {

    const assetPath =
      candidates[
        i
      ];


    const url =
      finalEmergExpandRepresentationUrl_(
        template,
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
      '[PDF DOWNLOAD] assetPath="'
      +
      assetPath
      +
      '" / HTTP='
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


      const bytes =
        blob.getBytes();


      if (
        bytes.length
        >=
        5
        &&
        String.fromCharCode(
          bytes[0]
          &
          0xff,
          bytes[1]
          &
          0xff,
          bytes[2]
          &
          0xff,
          bytes[3]
          &
          0xff
        )
        ===
        '%PDF'
      ) {

        return {
          blob:
            blob,

          assetPath:
            assetPath
        };
      }


      errors.push(
        'HTTP 200 but not PDF / assetPath='
        +
        assetPath
      );

      continue;
    }


    errors.push(
      'HTTP '
      +
      status
      +
      ' / assetPath='
      +
      assetPath
    );
  }


  throw new Error(
    'PDF Representation 다운로드 실패\n'
    +
    errors.join(
      '\n'
    )
  );
}


function finalEmergExpandRepresentationUrl_(
  urlTemplate,
  assetPath
) {

  let url =
    String(
      urlTemplate
    );


  url =
    url.replace(
      /\{\+asset_path\}/gi,
      assetPath
    );


  url =
    url.replace(
      /%7B%2Basset_path%7D/gi,
      assetPath
    );


  url =
    url.replace(
      /%7B\+asset_path%7D/gi,
      assetPath
    );


  if (
    /asset_path/i.test(
      url
    )
  ) {

    throw new Error(
      'Box Representation asset_path 치환 실패'
    );
  }


  return url;
}


function finalEmergGetZipText_(
  entries,
  targetName
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
      targetName
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
    targetName
  );
}


function finalEmergDecodeXml_(
  value
) {

  return String(
    value
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
      /&lt;/g,
      '<'
    )
    .replace(
      /&gt;/g,
      '>'
    )
    .replace(
      /&amp;/g,
      '&'
    );
}
