/**
 * =========================================================
 * STEP 3 Visual Calibration v2
 *
 * 목적
 * 1) 최종 Excel 원본은 그대로 유지
 * 2) Box PDF 변환용 임시 XLSX에만 ellipse X 보정 적용
 * 3) Box PDF에서 상단 빈 Cell Gridline이 검정 테두리처럼 보이는 현상을 차단
 * 4) -6px / -10px / -14px 좌측 보정 3개를 한번에 준비하여 육안 비교
 *
 * 전제
 * - Step3Poc_v6_AsyncPdf.gs가 같은 GAS 프로젝트에 존재
 * - BOX_STEP3_LAST_OUTPUT_FILE_ID = 정상 생성된 STEP3 XLSX
 * - BOX_TEST_FOLDER_ID 설정 완료
 * =========================================================
 */

const EMERG_PDF_CALIBRATION_DEFAULT_OFFSETS_EMU =
  [
    -57150,   // 약 -6px @ 96dpi
    -95250,   // 약 -10px
    -133350   // 약 -14px
  ];


/**
 * STEP 3-C1
 * PDF Render용 XLSX 3종 준비
 */
function runStep3VisualCalibrationPrepare() {

  console.log(
    '=============================='
  );

  console.log(
    '[STEP 3 VISUAL CALIBRATION PREPARE v2] START'
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


  console.log(
    'Source XLSX ID : '
    +
    sourceFileId
  );


  const sourceInfo =
    boxGetFileInfoStep3_(
      sourceFileId
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


  const offsets =
    getEmergCalibrationOffsets_();


  const time =
    Utilities.formatDate(
      new Date(),
      'Asia/Tokyo',
      'yyyyMMdd_HHmmss'
    );


  const outputs =
    [];


  offsets.forEach(
    function(offsetEmu) {

      const px =
        Math.round(
          offsetEmu
          /
          9525
        );


      let entries =
        cloneBlobArray_(
          sourceEntries
        );


      /*
       * 1. qualification ellipse를 PDF용으로 X축 이동
       */
      entries =
        replaceZipXmlEntry_(
          entries,
          'xl/drawings/drawing1.xml',
          function(xml) {

            return shiftQualificationEllipsesForPdf_(
              xml,
              offsetEmu
            );
          }
        );


      /*
       * 2. Box PDF에서 Gridline이 실제 Border처럼 진하게 보이지 않도록
       *    PDF render copy에서만 명시적으로 비활성화.
       */
      entries =
        replaceZipXmlEntry_(
          entries,
          'xl/worksheets/sheet1.xml',
          function(xml) {

            return enforceNoGridlinesForPdf_(
              xml
            );
          }
        );


      /*
       * 3. XML 최종 Gate
       */
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


      const pxLabel =
        px < 0
          ? 'L'
            +
            String(
              Math.abs(
                px
              )
            ).padStart(
              2,
              '0'
            )
          : 'R'
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
        pxLabel
        +
        '_'
        +
        time
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
        px
        +
        'px → XLSX ID='
        +
        uploaded.id
      );


      outputs.push(
        {
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


  PropertiesService
    .getScriptProperties()
    .setProperty(
      'EMERG_PDF_CALIBRATION_FILES_JSON',
      JSON.stringify(
        outputs
      )
    );


  console.log(
    '=============================='
  );

  console.log(
    '[STEP 3 VISUAL CALIBRATION PREPARE v2] RESULT = OK'
  );

  console.log(
    '잠시 후 runStep3VisualCalibrationPdf() 실행'
  );

  console.log(
    '=============================='
  );


  return outputs;
}


/**
 * STEP 3-C2
 * 준비된 XLSX 중 PDF 변환 완료 파일만 저장
 */
function runStep3VisualCalibrationPdf() {

  console.log(
    '=============================='
  );

  console.log(
    '[STEP 3 VISUAL CALIBRATION PDF v2] START'
  );

  console.log(
    '=============================='
  );


  const props =
    PropertiesService
      .getScriptProperties();


  const json =
    props.getProperty(
      'EMERG_PDF_CALIBRATION_FILES_JSON'
    );


  if (!json) {

    throw new Error(
      '먼저 runStep3VisualCalibrationPrepare()를 실행하세요.'
    );
  }


  const items =
    JSON.parse(
      json
    );


  const testFolderId =
    getRequiredProperty_(
      'BOX_TEST_FOLDER_ID'
    );


  let readyCount =
    0;


  let pendingCount =
    0;


  items.forEach(
    function(item) {

      if (
        item.pdfDone
      ) {

        readyCount++;

        console.log(
          '[SKIP] '
          +
          item.px
          +
          'px 이미 PDF 완료'
        );

        return;
      }


      const rep =
        boxGetPdfRepresentation_(
          item.xlsxFileId
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
        '[CHECK] '
        +
        item.px
        +
        'px / state='
        +
        state
      );


      if (
        state
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


      const pxValue =
        Number(
          item.px
        );


      const pxLabel =
        pxValue < 0
          ? 'L'
            +
            String(
              Math.abs(
                pxValue
              )
            ).padStart(
              2,
              '0'
            )
          : 'R'
            +
            String(
              Math.abs(
                pxValue
              )
            ).padStart(
              2,
              '0'
            );


      const pdfName =
        'STEP3_Emerg_PDF_CAL_'
        +
        pxLabel
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
        item.px
        +
        'px'
        +
        ' / PDF ID='
        +
        item.pdfFileId
      );
    }
  );


  props.setProperty(
    'EMERG_PDF_CALIBRATION_FILES_JSON',
    JSON.stringify(
      items
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
    '[STEP 3 VISUAL CALIBRATION PDF v2] END'
  );

  console.log(
    '=============================='
  );


  return {
    ready:
      readyCount,

    pending:
      pendingCount,

    items:
      items
  };
}


/**
 * 최종 선택된 Offset 저장
 *
 * 예:
 * setEmergPdfEllipseOffsetPx(-10)
 */
function setEmergPdfEllipseOffsetPx(
  px
) {

  const value =
    Number(
      px
    );


  if (
    !isFinite(
      value
    )
    ||
    value
    <
    -50
    ||
    value
    >
    50
  ) {

    throw new Error(
      'Offset px는 -50~50 범위의 숫자여야 합니다.'
    );
  }


  const emu =
    Math.round(
      value
      *
      9525
    );


  PropertiesService
    .getScriptProperties()
    .setProperty(
      'EMERG_PDF_ELLIPSE_X_OFFSET_EMU',
      String(
        emu
      )
    );


  console.log(
    'EMERG_PDF_ELLIPSE_X_OFFSET_EMU='
    +
    emu
    +
    ' ('
    +
    value
    +
    'px)'
  );


  return {
    px:
      value,

    emu:
      emu
  };
}


/**
 * 후보 Offset
 *
 * Script Property를 별도로 쓰고 싶으면:
 * EMERG_PDF_CALIBRATION_OFFSETS_PX
 * 예: -6,-10,-14
 */
function getEmergCalibrationOffsets_() {

  const raw =
    String(
      PropertiesService
        .getScriptProperties()
        .getProperty(
          'EMERG_PDF_CALIBRATION_OFFSETS_PX'
        )
      ||
      ''
    )
      .trim();


  if (!raw) {

    return EMERG_PDF_CALIBRATION_DEFAULT_OFFSETS_EMU
      .slice();
  }


  const result =
    raw
      .split(',')
      .map(
        function(value) {

          const px =
            Number(
              String(
                value
              )
                .trim()
            );


          if (
            !isFinite(
              px
            )
          ) {

            throw new Error(
              '잘못된 Calibration px: '
              +
              value
            );
          }


          return Math.round(
            px
            *
            9525
          );
        }
      );


  if (
    !result.length
  ) {

    throw new Error(
      'Calibration Offset가 없습니다.'
    );
  }


  return result;
}


/**
 * Blob Array 복제
 */
function cloneBlobArray_(
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
 * Qualification Ellipse만 X축 이동
 *
 * 음수 = 왼쪽
 * 양수 = 오른쪽
 *
 * 원본 Excel에는 적용하지 않고 PDF render copy에서만 사용.
 */
function shiftQualificationEllipsesForPdf_(
  drawingXml,
  offsetEmu
) {

  const delta =
    Number(
      offsetEmu
    );


  if (
    !isFinite(
      delta
    )
  ) {

    throw new Error(
      'Ellipse Offset이 숫자가 아닙니다.'
    );
  }


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
    'drawing1.xml after ellipse PDF offset'
  );


  return output;
}


/**
 * Box PDF용 Gridline OFF
 *
 * 첨부화면의 상단 빨간영역처럼 빈 Cell의 경계가 검정색 테두리로
 * 표시되는 현상을 막기 위한 PDF render-copy 전용 처리.
 *
 * 원본 Excel은 변경하지 않습니다.
 */
function enforceNoGridlinesForPdf_(
  sheetXml
) {

  let output =
    String(
      sheetXml
    );


  /*
   * sheetView: gridline 숨김 + normal view
   */
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


  /*
   * printOptions: Gridline 명시 OFF
   */
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
              gridLines: '0',
              gridLinesSet: '1',
              headings: '0'
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
    'sheet1.xml after no-gridline PDF profile'
  );


  if (
    !/<sheetView\b[^>]*\bshowGridLines="0"/
      .test(
        output
      )
  ) {

    throw new Error(
      'PDF Gridline OFF: sheetView 적용 실패'
    );
  }


  if (
    !/<printOptions\b[^>]*\bgridLines="0"/
      .test(
        output
      )
  ) {

    throw new Error(
      'PDF Gridline OFF: printOptions 적용 실패'
    );
  }


  return output;
}
