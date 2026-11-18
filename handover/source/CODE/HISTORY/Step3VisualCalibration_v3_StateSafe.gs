/**
 * =========================================================
 * STEP 3 Visual Calibration v3
 *
 * 핵심 수정:
 * - 이전 Calibration 상태(JSON)를 버전/방향까지 검증
 * - stale 상태면 "완료"로 SKIP하지 않음
 * - PDF File ID가 실제 Box에 존재할 때만 SKIP
 * - v3 Profile: LEFT_NO_GRIDLINES_V3
 *
 * 전제:
 * - Step3Poc_v6_AsyncPdf.gs가 같은 GAS 프로젝트에 존재
 * - BOX_STEP3_LAST_OUTPUT_FILE_ID = 정상 생성된 STEP3 XLSX
 * - BOX_TEST_FOLDER_ID 설정 완료
 * =========================================================
 */

const EMERG_CAL_PROFILE_VERSION =
  'LEFT_NO_GRIDLINES_V3';

const EMERG_CAL_OFFSETS_PX =
  [
    -6,
    -10,
    -14
  ];


/**
 * STEP 3-C1
 * 이전 Calibration 상태를 폐기하고 새 LEFT 후보 3종을 생성.
 */
function runStep3VisualCalibrationPrepare() {

  console.log(
    '=============================='
  );

  console.log(
    '[STEP 3 VISUAL CALIBRATION PREPARE v3] START'
  );

  console.log(
    '=============================='
  );


  const sourceFileId =
    getRequiredProperty_(
      'BOX_STEP3_LAST_OUTPUT_FILE_ID'
    );


  const testFolderId =
    getRequiredProperty_(
      'BOX_TEST_FOLDER_ID'
    );


  const sourceInfo =
    boxGetFileInfoStep3_(
      sourceFileId
    );


  console.log(
    'Source XLSX ID : '
    +
    sourceFileId
  );

  console.log(
    'Source XLSX Name : '
    +
    sourceInfo.name
  );


  const sourceBlob =
    boxDownloadFile_(
      sourceFileId
    )
      .copyBlob()
      .setName(
        sourceInfo.name
      );


  const sourceEntries =
    Utilities.unzip(
      asZipBlobForUnzip_(
        sourceBlob
      )
    );


  assertWellFormedXml_(
    getZipEntryText_(
      sourceEntries,
      'xl/worksheets/sheet1.xml'
    ),
    'source sheet1.xml'
  );


  const runId =
    Utilities.formatDate(
      new Date(),
      'Asia/Tokyo',
      'yyyyMMdd_HHmmss'
    );


  const items =
    [];


  EMERG_CAL_OFFSETS_PX.forEach(
    function(px) {

      const offsetEmu =
        Math.round(
          px
          *
          9525
        );


      let entries =
        cloneBlobArrayCalV3_(
          sourceEntries
        );


      entries =
        replaceZipXmlEntry_(
          entries,
          'xl/drawings/drawing1.xml',
          function(xml) {

            return shiftQualificationEllipsesCalV3_(
              xml,
              offsetEmu
            );
          }
        );


      entries =
        replaceZipXmlEntry_(
          entries,
          'xl/worksheets/sheet1.xml',
          function(xml) {

            return enforceNoGridlinesCalV3_(
              xml
            );
          }
        );


      assertWellFormedXml_(
        getZipEntryText_(
          entries,
          'xl/worksheets/sheet1.xml'
        ),
        'calibration sheet1.xml'
      );


      assertWellFormedXml_(
        getZipEntryText_(
          entries,
          'xl/drawings/drawing1.xml'
        ),
        'calibration drawing1.xml'
      );


      const label =
        'L'
        +
        String(
          Math.abs(
            px
          )
        ).padStart(
          2,
          '0'
        );


      const fileName =
        'STEP3_Emerg_PDF_CAL_'
        +
        label
        +
        '_'
        +
        runId
        +
        '.xlsx';


      const zipBlob =
        Utilities.zip(
          entries,
          fileName
        );


      const uploadBlob =
        zipBlob
          .copyBlob()
          .setName(
            fileName
          )
          .setContentType(
            STEP3_XLSX_MIME
          );


      const uploaded =
        boxUploadFile_(
          testFolderId,
          fileName,
          uploadBlob
        );


      console.log(
        '[PREP] '
        +
        label
        +
        ' / '
        +
        px
        +
        'px → XLSX ID='
        +
        uploaded.id
      );


      items.push(
        {
          profileVersion:
            EMERG_CAL_PROFILE_VERSION,

          runId:
            runId,

          label:
            label,

          px:
            px,

          offsetEmu:
            offsetEmu,

          xlsxFileId:
            String(
              uploaded.id
            ),

          xlsxFileName:
            fileName,

          pdfDone:
            false,

          pdfFileId:
            '',

          pdfFileName:
            ''
        }
      );
    }
  );


  const state =
    {
      profileVersion:
        EMERG_CAL_PROFILE_VERSION,

      runId:
        runId,

      sourceFileId:
        String(
          sourceFileId
        ),

      createdAt:
        new Date().toISOString(),

      items:
        items
    };


  PropertiesService
    .getScriptProperties()
    .setProperty(
      'EMERG_PDF_CALIBRATION_STATE_JSON',
      JSON.stringify(
        state
      )
    );


  /*
   * 구버전 상태는 더 이상 사용하지 않음.
   */
  PropertiesService
    .getScriptProperties()
    .deleteProperty(
      'EMERG_PDF_CALIBRATION_FILES_JSON'
    );


  console.log(
    'Calibration State Profile : '
    +
    EMERG_CAL_PROFILE_VERSION
  );

  console.log(
    'Calibration Run ID : '
    +
    runId
  );

  console.log(
    '=============================='
  );

  console.log(
    '[STEP 3 VISUAL CALIBRATION PREPARE v3] RESULT = OK'
  );

  console.log(
    'Box에 L06 / L10 / L14 XLSX 3개가 생성되었는지 확인하세요.'
  );

  console.log(
    '그 다음 runStep3VisualCalibrationPdf() 실행'
  );

  console.log(
    '=============================='
  );


  return state;
}


/**
 * STEP 3-C2
 *
 * 현재 v3 State만 허용.
 * pdfDone=true라도 실제 Box PDF File이 존재하지 않으면 SKIP하지 않고 재생성.
 */
function runStep3VisualCalibrationPdf() {

  console.log(
    '=============================='
  );

  console.log(
    '[STEP 3 VISUAL CALIBRATION PDF v3] START'
  );

  console.log(
    '=============================='
  );


  const props =
    PropertiesService
      .getScriptProperties();


  const json =
    props.getProperty(
      'EMERG_PDF_CALIBRATION_STATE_JSON'
    );


  if (!json) {

    throw new Error(
      [
        'v3 Calibration State가 없습니다.',
        '먼저 runStep3VisualCalibrationPrepare()를 실행하세요.'
      ].join('\n')
    );
  }


  const state =
    JSON.parse(
      json
    );


  if (
    state.profileVersion
    !==
    EMERG_CAL_PROFILE_VERSION
  ) {

    throw new Error(
      [
        '이전 Calibration 상태가 남아 있습니다.',
        '현재 필요 Profile: '
          + EMERG_CAL_PROFILE_VERSION,
        '먼저 runStep3VisualCalibrationPrepare()를 다시 실행하세요.'
      ].join('\n')
    );
  }


  if (
    !Array.isArray(
      state.items
    )
    ||
    state.items.length
    !==
    3
  ) {

    throw new Error(
      'Calibration State의 항목 수가 3개가 아닙니다. Prepare를 다시 실행하세요.'
    );
  }


  const expected =
    JSON.stringify(
      EMERG_CAL_OFFSETS_PX
    );


  const actual =
    JSON.stringify(
      state.items.map(
        function(item) {

          return Number(
            item.px
          );
        }
      )
    );


  if (
    expected
    !==
    actual
  ) {

    throw new Error(
      [
        'Calibration Offset가 현재 v3 규칙과 다릅니다.',
        'Expected=' + expected,
        'Actual=' + actual,
        'runStep3VisualCalibrationPrepare()를 다시 실행하세요.'
      ].join('\n')
    );
  }


  const testFolderId =
    getRequiredProperty_(
      'BOX_TEST_FOLDER_ID'
    );


  let readyCount =
    0;


  let pendingCount =
    0;


  state.items.forEach(
    function(item) {

      /*
       * 완료 표시가 있더라도 실제 Box File 존재를 확인.
       */
      if (
        item.pdfDone
        &&
        item.pdfFileId
        &&
        boxFileExistsCalV3_(
          item.pdfFileId
        )
      ) {

        readyCount++;

        console.log(
          '[SKIP VERIFIED] '
          +
          item.label
          +
          ' / PDF ID='
          +
          item.pdfFileId
        );

        return;
      }


      /*
       * stale 완료표시 정리.
       */
      item.pdfDone =
        false;

      item.pdfFileId =
        '';

      item.pdfFileName =
        '';


      if (
        !boxFileExistsCalV3_(
          item.xlsxFileId
        )
      ) {

        throw new Error(
          [
            item.label
              + ' Calibration XLSX가 Box에 없습니다.',
            'XLSX ID='
              + item.xlsxFileId,
            'runStep3VisualCalibrationPrepare()를 다시 실행하세요.'
          ].join('\n')
        );
      }


      const rep =
        boxGetPdfRepresentation_(
          item.xlsxFileId
        );


      const repState =
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
        '[CHECK] '
        +
        item.label
        +
        ' / '
        +
        item.px
        +
        'px / state='
        +
        repState
      );


      if (
        repState
        !==
        'success'
      ) {

        pendingCount++;

        return;
      }


      const pdf =
        boxDownloadPdfRepresentationSmart_(
          item.xlsxFileId
        );


      const time =
        Utilities.formatDate(
          new Date(),
          'Asia/Tokyo',
          'yyyyMMdd_HHmmss'
        );


      const pdfName =
        'STEP3_Emerg_PDF_CAL_'
        +
        item.label
        +
        '_'
        +
        time
        +
        '.pdf';


      const uploadedPdf =
        boxUploadFile_(
          testFolderId,
          pdfName,
          pdf.blob
            .setName(
              pdfName
            )
        );


      item.pdfDone =
        true;

      item.pdfFileId =
        String(
          uploadedPdf.id
        );

      item.pdfFileName =
        pdfName;


      readyCount++;


      console.log(
        '[PDF OK] '
        +
        item.label
        +
        ' / PDF ID='
        +
        item.pdfFileId
      );
    }
  );


  props.setProperty(
    'EMERG_PDF_CALIBRATION_STATE_JSON',
    JSON.stringify(
      state
    )
  );


  console.log(
    'Ready='
    +
    readyCount
    +
    ' / Pending='
    +
    pendingCount
  );


  if (
    pendingCount
    >
    0
  ) {

    console.log(
      'pending 파일이 있습니다. 잠시 후 같은 함수를 다시 실행하세요.'
    );
  }


  console.log(
    '=============================='
  );

  console.log(
    '[STEP 3 VISUAL CALIBRATION PDF v3] END'
  );

  console.log(
    '=============================='
  );


  return {
    ready:
      readyCount,

    pending:
      pendingCount,

    profileVersion:
      state.profileVersion,

    runId:
      state.runId,

    items:
      state.items
  };
}


/**
 * Box File 존재 확인
 */
function boxFileExistsCalV3_(
  fileId
) {

  const id =
    String(
      fileId
      ||
      ''
    )
      .trim();


  if (!id) {

    return false;
  }


  const url =
    'https://api.box.com/2.0/files/'
    +
    encodeURIComponent(
      id
    )
    +
    '?fields=id,name,item_status';


  const response =
    UrlFetchApp.fetch(
      url,
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

    return false;
  }


  const json =
    JSON.parse(
      response.getContentText()
    );


  return (
    String(
      json.item_status
      ||
      'active'
    )
    ===
    'active'
  );
}


/**
 * Blob Array 복제
 */
function cloneBlobArrayCalV3_(
  entries
) {

  return entries.map(
    function(blob) {

      return blob
        .copyBlob()
        .setName(
          blob.getName()
        );
    }
  );
}


/**
 * Qualification ellipse X offset
 *
 * 음수 = 왼쪽
 * 양수 = 오른쪽
 */
function shiftQualificationEllipsesCalV3_(
  drawingXml,
  offsetEmu
) {

  const delta =
    Number(
      offsetEmu
    );


  let changed =
    0;


  const output =
    String(
      drawingXml
    )
      .replace(
        /<xdr:twoCellAnchor\b[\s\S]*?<\/xdr:twoCellAnchor>/g,
        function(anchorXml) {

          if (
            anchorXml.indexOf(
              'prst="ellipse"'
            )
            ===
            -1
          ) {

            return anchorXml;
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

            return anchorXml;
          }


          let shifted =
            anchorXml;


          let colOffIndex =
            0;


          shifted =
            shifted.replace(
              /<xdr:colOff>(-?\d+)<\/xdr:colOff>/g,
              function(
                match,
                value
              ) {

                colOffIndex++;


                if (
                  colOffIndex
                  >
                  2
                ) {

                  return match;
                }


                return (
                  '<xdr:colOff>'
                  +
                  (
                    Number(
                      value
                    )
                    +
                    delta
                  )
                  +
                  '</xdr:colOff>'
                );
              }
            );


          shifted =
            shifted.replace(
              /<a:off\b([^>]*?)\bx="(-?\d+)"([^>]*)\/>/,
              function(
                match,
                before,
                x,
                after
              ) {

                return (
                  '<a:off'
                  +
                  before
                  +
                  'x="'
                  +
                  (
                    Number(
                      x
                    )
                    +
                    delta
                  )
                  +
                  '"'
                  +
                  after
                  +
                  '/>'
                );
              }
            );


          changed++;


          return shifted;
        }
      );


  if (
    changed
    !==
    28
  ) {

    throw new Error(
      'PDF Offset 적용 ellipse 수가 28개가 아닙니다. actual='
      +
      changed
    );
  }


  assertWellFormedXml_(
    output,
    'drawing1.xml after ellipse calibration'
  );


  return output;
}


/**
 * Box PDF용 Gridline OFF
 */
function enforceNoGridlinesCalV3_(
  sheetXml
) {

  let output =
    String(
      sheetXml
    );


  output =
    output.replace(
      /<sheetView\b([^>]*)>/,
      function(
        full,
        attrs
      ) {

        let newAttrs =
          String(
            attrs
            ||
            ''
          );


        if (
          /\bshowGridLines="[^"]*"/.test(
            newAttrs
          )
        ) {

          newAttrs =
            newAttrs.replace(
              /\bshowGridLines="[^"]*"/,
              'showGridLines="0"'
            );
        }

        else {

          newAttrs +=
            ' showGridLines="0"';
        }


        if (
          /\bview="[^"]*"/.test(
            newAttrs
          )
        ) {

          newAttrs =
            newAttrs.replace(
              /\bview="[^"]*"/,
              'view="normal"'
            );
        }

        else {

          newAttrs +=
            ' view="normal"';
        }


        return (
          '<sheetView'
          +
          newAttrs
          +
          '>'
        );
      }
    );


  const printOptionsRegex =
    /<printOptions\b([^>]*)\/>/;


  if (
    printOptionsRegex.test(
      output
    )
  ) {

    output =
      output.replace(
        printOptionsRegex,
        function(
          full,
          attrs
        ) {

          let newAttrs =
            String(
              attrs
              ||
              ''
            );


          const settings =
            {
              gridLines:
                '0',

              gridLinesSet:
                '1',

              headings:
                '0'
            };


          Object.keys(
            settings
          )
            .forEach(
              function(key) {

                const value =
                  settings[
                    key
                  ];


                const regex =
                  new RegExp(
                    '\\b'
                    +
                    key
                    +
                    '="[^"]*"'
                  );


                if (
                  regex.test(
                    newAttrs
                  )
                ) {

                  newAttrs =
                    newAttrs.replace(
                      regex,
                      key
                      +
                      '="'
                      +
                      value
                      +
                      '"'
                    );
                }

                else {

                  newAttrs +=
                    ' '
                    +
                    key
                    +
                    '="'
                    +
                    value
                    +
                    '"';
                }
              }
            );


          return (
            '<printOptions'
            +
            newAttrs
            +
            '/>'
          );
        }
      );
  }

  else {

    output =
      output.replace(
        '</worksheet>',
        '<printOptions gridLines="0" gridLinesSet="1" headings="0"/>'
        +
        '</worksheet>'
      );
  }


  assertWellFormedXml_(
    output,
    'sheet1.xml after no-gridline calibration'
  );


  return output;
}
