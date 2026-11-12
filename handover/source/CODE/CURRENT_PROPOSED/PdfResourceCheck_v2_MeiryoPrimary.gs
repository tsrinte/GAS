/**
 * =========================================================
 * PDF System Resource Check v2
 * Dual Font Resource / Meiryo Primary
 *
 * Production policy:
 * - Static form/background: Emerg_Master_Blank_v2.pdf (unchanged)
 * - Dynamic input text: Meiryo REGULAR
 * - Bold is NOT used for dynamic overlay text
 * - MS Gothic is retained only as a fallback/compatibility resource
 *
 * Script Properties:
 * - BOX_EMERG_MASTER_PDF_FILE_ID
 * - BOX_PDF_FONT_MEIRYO_FILE_ID      <- PRIMARY
 * - BOX_PDF_FONT_MSGOTHIC_FILE_ID    <- FALLBACK
 *
 * Optional:
 * - BOX_PDF_RESOURCE_FOLDER_ID
 * =========================================================
 */


function runPdfResourceCheck() {

  console.log(
    '=============================='
  );

  console.log(
    '[PDF RESOURCE CHECK v2] START'
  );

  console.log(
    '=============================='
  );


  const masterPdfId =
    getRequiredProperty_(
      'BOX_EMERG_MASTER_PDF_FILE_ID'
    );


  const meiryoFontId =
    getRequiredProperty_(
      'BOX_PDF_FONT_MEIRYO_FILE_ID'
    );


  const msGothicFontId =
    getRequiredProperty_(
      'BOX_PDF_FONT_MSGOTHIC_FILE_ID'
    );


  const master =
    checkPdfMasterResource_(
      masterPdfId
    );


  const meiryo =
    checkPdfFontResource_(
      meiryoFontId,
      'MEIRYO_PRIMARY'
    );


  const msGothic =
    checkPdfFontResource_(
      msGothicFontId,
      'MS_GOTHIC_FALLBACK'
    );


  console.log(
    '------------------------------'
  );

  console.log(
    '[MASTER PDF] OK'
  );

  logPdfResource_(
    master
  );


  console.log(
    '------------------------------'
  );

  console.log(
    '[MEIRYO PRIMARY] OK'
  );

  logPdfResource_(
    meiryo
  );


  console.log(
    'Dynamic PDF input font = MEIRYO / REGULAR / NON-BOLD'
  );


  console.log(
    '------------------------------'
  );

  console.log(
    '[MS GOTHIC FALLBACK] OK'
  );

  logPdfResource_(
    msGothic
  );


  console.log(
    '=============================='
  );

  console.log(
    '[PDF RESOURCE CHECK v2] RESULT = OK'
  );

  console.log(
    '=============================='
  );


  return {
    ok:
      true,

    inputFontPolicy:
      {
        primary:
          'MEIRYO',

        weight:
          'REGULAR',

        bold:
          false,

        fallback:
          'MS_GOTHIC'
      },

    masterPdf:
      master,

    meiryo:
      meiryo,

    msGothic:
      msGothic
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


  if (
    bytesToAscii_(
      bytes,
      0,
      5
    )
    !==
    '%PDF-'
  ) {

    throw new Error(
      'Master PDF Signature가 올바르지 않습니다.'
    );
  }


  return {
    role:
      'MASTER_PDF',

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
      getFileVersionId_(
        info
      )
  };
}


function checkPdfFontResource_(
  fileId,
  role
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
        role
        +
        ' Font 파일이 TTF/TTC/OTF가 아닙니다.',
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
      role
      +
      ' Font 파일 크기가 비정상적으로 작습니다.'
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
      role
      +
      ' Font Signature를 인식할 수 없습니다.'
    );
  }


  return {
    role:
      role,

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
      getFileVersionId_(
        info
      )
  };
}


function logPdfResource_(
  resource
) {

  console.log(
    'Role : '
    +
    resource.role
  );

  console.log(
    'ID   : '
    +
    resource.id
  );

  console.log(
    'Name : '
    +
    resource.name
  );

  console.log(
    'Size : '
    +
    resource.size
  );


  if (
    resource.fontType
  ) {

    console.log(
      'Type : '
      +
      resource.fontType
    );
  }


  if (
    resource.fileVersionId
  ) {

    console.log(
      'Version ID : '
      +
      resource.fileVersionId
    );
  }
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


function getFileVersionId_(
  info
) {

  return (
    info.file_version
    &&
    info.file_version.id
  )
    ? String(
        info.file_version.id
      )
    : '';
}


function detectOpenTypeFontType_(
  bytes
) {

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


  if (
    tag
    ===
    'OTTO'
  ) {

    return 'OTF';
  }


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
