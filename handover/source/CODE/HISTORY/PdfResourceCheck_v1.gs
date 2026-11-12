/**
 * =========================================================
 * PDF System Resource Check v1
 *
 * 목적:
 * - PDF Master와 MS Gothic 폰트를 Box의 시스템 리소스로 고정 관리
 * - Web App 사용자는 폰트/리소스를 선택하지 않음
 * - Box에서 새 Version으로 교체하면 File ID를 유지할 수 있어 유지보수 용이
 *
 * 필요 공통함수:
 * - getRequiredProperty_()
 * - getBoxAuthHeader_()
 * - boxDownloadFile_()
 *
 * Script Properties:
 * - BOX_EMERG_MASTER_PDF_FILE_ID
 * - BOX_PDF_FONT_FILE_ID
 *
 * 선택:
 * - BOX_PDF_RESOURCE_FOLDER_ID
 * =========================================================
 */


function runPdfResourceCheck() {

  console.log(
    '=============================='
  );

  console.log(
    '[PDF RESOURCE CHECK] START'
  );

  console.log(
    '=============================='
  );


  const masterPdfId =
    getRequiredProperty_(
      'BOX_EMERG_MASTER_PDF_FILE_ID'
    );


  const fontFileId =
    getRequiredProperty_(
      'BOX_PDF_FONT_FILE_ID'
    );


  const master =
    checkPdfMasterResource_(
      masterPdfId
    );


  const font =
    checkPdfFontResource_(
      fontFileId
    );


  console.log(
    '------------------------------'
  );

  console.log(
    '[MASTER PDF] OK'
  );

  console.log(
    'ID   : '
    +
    master.id
  );

  console.log(
    'Name : '
    +
    master.name
  );

  console.log(
    'Size : '
    +
    master.size
  );


  console.log(
    '------------------------------'
  );

  console.log(
    '[PDF FONT] OK'
  );

  console.log(
    'ID   : '
    +
    font.id
  );

  console.log(
    'Name : '
    +
    font.name
  );

  console.log(
    'Size : '
    +
    font.size
  );

  console.log(
    'Type : '
    +
    font.fontType
  );


  console.log(
    '=============================='
  );

  console.log(
    '[PDF RESOURCE CHECK] RESULT = OK'
  );

  console.log(
    '=============================='
  );


  return {
    ok:
      true,

    masterPdf:
      master,

    font:
      font
  };
}


function checkPdfMasterResource_(
  fileId
) {

  const info =
    getPdfResourceBoxFileInfo_(
      fileId
    );


  if (
    !/\.pdf$/i.test(
      info.name
    )
  ) {

    throw new Error(
      'BOX_EMERG_MASTER_PDF_FILE_ID가 PDF 파일이 아닙니다: '
      +
      info.name
    );
  }


  const blob =
    boxDownloadFile_(
      fileId
    );


  const bytes =
    blob.getBytes();


  if (
    bytes.length
    <
    8
  ) {

    throw new Error(
      'Master PDF 파일 크기가 비정상적으로 작습니다.'
    );
  }


  const header =
    bytesToAscii_(
      bytes,
      0,
      5
    );


  if (
    header
    !==
    '%PDF-'
  ) {

    throw new Error(
      'Master PDF Signature가 올바르지 않습니다.'
    );
  }


  return {
    id:
      String(
        info.id
      ),

    name:
      info.name,

    size:
      Number(
        info.size
        ||
        bytes.length
      ),

    fileVersionId:
      info.file_version
      &&
      info.file_version.id
        ? String(
            info.file_version.id
          )
        : ''
  };
}


function checkPdfFontResource_(
  fileId
) {

  const info =
    getPdfResourceBoxFileInfo_(
      fileId
    );


  if (
    !/\.(?:ttf|ttc|otf)$/i.test(
      info.name
    )
  ) {

    throw new Error(
      [
        'BOX_PDF_FONT_FILE_ID가 지원 Font 파일이 아닙니다.',
        'TTF / TTC / OTF 중 하나를 사용하세요.',
        'File='
        +
        info.name
      ].join(
        '\n'
      )
    );
  }


  const blob =
    boxDownloadFile_(
      fileId
    );


  const bytes =
    blob.getBytes();


  if (
    bytes.length
    <
    12
  ) {

    throw new Error(
      'Font 파일 크기가 비정상적으로 작습니다.'
    );
  }


  const fontType =
    detectOpenTypeFontType_(
      bytes
    );


  if (
    fontType
    ===
    'UNKNOWN'
  ) {

    throw new Error(
      'Font Signature를 인식할 수 없습니다.'
    );
  }


  return {
    id:
      String(
        info.id
      ),

    name:
      info.name,

    size:
      Number(
        info.size
        ||
        bytes.length
      ),

    fontType:
      fontType,

    fileVersionId:
      info.file_version
      &&
      info.file_version.id
        ? String(
            info.file_version.id
          )
        : ''
  };
}


function getPdfResourceBoxFileInfo_(
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
      '?fields=id,name,size,file_version,item_status',
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
      [
        'Box Resource File Info 조회 실패',
        'File ID='
        +
        fileId,
        'HTTP='
        +
        status,
        response.getContentText()
      ].join(
        '\n'
      )
    );
  }


  const json =
    JSON.parse(
      response.getContentText()
    );


  if (
    String(
      json.item_status
      ||
      'active'
    )
    !==
    'active'
  ) {

    throw new Error(
      'Box Resource File이 active 상태가 아닙니다: '
      +
      json.name
    );
  }


  return json;
}


function detectOpenTypeFontType_(
  bytes
) {

  /*
   * TTC = ttcf
   */
  const tag =
    bytesToAscii_(
      bytes,
      0,
      4
    );


  if (
    tag
    ===
    'ttcf'
  ) {

    return 'TTC';
  }


  /*
   * OpenType CFF = OTTO
   */
  if (
    tag
    ===
    'OTTO'
  ) {

    return 'OTF';
  }


  /*
   * TrueType sfnt = 0x00010000
   */
  const b0 =
    bytes[
      0
    ]
    &
    0xff;


  const b1 =
    bytes[
      1
    ]
    &
    0xff;


  const b2 =
    bytes[
      2
    ]
    &
    0xff;


  const b3 =
    bytes[
      3
    ]
    &
    0xff;


  if (
    b0
    ===
    0x00
    &&
    b1
    ===
    0x01
    &&
    b2
    ===
    0x00
    &&
    b3
    ===
    0x00
  ) {

    return 'TTF';
  }


  return 'UNKNOWN';
}


function bytesToAscii_(
  bytes,
  start,
  length
) {

  let result =
    '';


  for (
    let i = start;
    i < start + length;
    i++
  ) {

    result +=
      String.fromCharCode(
        bytes[
          i
        ]
        &
        0xff
      );
  }


  return result;
}
