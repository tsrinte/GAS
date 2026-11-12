/**
 * =========================================================
 * BoxUploadOrVersion.gs
 *
 * 목적:
 * - 같은 폴더에 같은 파일명이 없으면 신규 업로드
 * - 같은 파일명이 이미 있으면 Box의 "새 Version"으로 업로드
 *
 * 장점:
 * - r1/r2 같은 중복 파일이 계속 늘어나지 않음
 * - 같은 Box File ID 유지
 * - Box Version History로 이전 결과 추적 가능
 *
 * Requires:
 * - boxUploadFile_(folderId, fileName, blob)
 * - getBoxAuthHeader_()
 * =========================================================
 */


function boxUploadOrNewVersion_(
  folderId,
  fileName,
  blob
) {

  try {

    const uploaded =
      boxUploadFile_(
        folderId,
        fileName,
        blob
      );


    uploaded.uploadMode =
      'NEW_FILE';


    return uploaded;
  }

  catch (error) {

    const message =
      error
      &&
      error.message
        ? error.message
        : String(
            error
          );


    /*
     * Box 신규 업로드에서 동일 파일명이 존재하면:
     * HTTP 409 / code=item_name_in_use
     */
    if (
      message.indexOf(
        'HTTP=409'
      )
      ===
      -1
      ||
      message.indexOf(
        'item_name_in_use'
      )
      ===
      -1
    ) {

      throw error;
    }


    const existingFileId =
      extractBoxConflictFileId_(
        message
      );


    if (!existingFileId) {

      throw new Error(
        [
          '같은 이름의 Box 파일이 존재하지만 기존 File ID를 추출하지 못했습니다.',
          message
        ].join(
          '\n'
        )
      );
    }


    console.log(
      '[BOX UPLOAD] Same name exists.'
    );


    console.log(
      '[BOX UPLOAD] Existing File ID = '
      +
      existingFileId
    );


    console.log(
      '[BOX UPLOAD] Upload as NEW VERSION.'
    );


    return boxUploadNewVersion_(
      existingFileId,
      fileName,
      blob
    );
  }
}


function extractBoxConflictFileId_(
  message
) {

  /*
   * Expected fragment:
   * "conflicts":{"type":"file","id":"2491164136107",...
   */
  const match =
    String(
      message
      ||
      ''
    )
      .match(
        /"conflicts"\s*:\s*\{[\s\S]*?"type"\s*:\s*"file"[\s\S]*?"id"\s*:\s*"(\d+)"/
      );


  return match
    ? match[
        1
      ]
    : '';
}


function boxUploadNewVersion_(
  existingFileId,
  fileName,
  blob
) {

  const url =
    'https://upload.box.com/api/2.0/files/'
    +
    encodeURIComponent(
      existingFileId
    )
    +
    '/content';


  const attributes =
    {
      name:
        fileName
    };


  const response =
    UrlFetchApp.fetch(
      url,
      {
        method:
          'post',

        headers:
          getBoxAuthHeader_(),

        payload:
          {
            attributes:
              JSON.stringify(
                attributes
              ),

            file:
              blob
          },

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
    &&
    status
    !==
    201
  ) {

    throw new Error(
      [
        'Box File Version Upload 실패',
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
    !json.entries
    ||
    !json.entries.length
  ) {

    throw new Error(
      'Box File Version Upload 응답에 entries가 없습니다.'
    );
  }


  const uploaded =
    json.entries[
      0
    ];


  uploaded.uploadMode =
    'NEW_VERSION';


  console.log(
    '[BOX UPLOAD] New Version OK'
  );


  console.log(
    '[BOX UPLOAD] File ID = '
    +
    uploaded.id
  );


  console.log(
    '[BOX UPLOAD] Version ID = '
    +
    (
      uploaded.file_version
      &&
      uploaded.file_version.id
        ? uploaded.file_version.id
        : '-'
    )
  );


  return uploaded;
}
