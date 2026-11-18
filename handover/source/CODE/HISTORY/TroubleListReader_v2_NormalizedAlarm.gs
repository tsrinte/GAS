/**
 * =========================================================
 * TroubleListReader v2
 *
 * STEP 4A:
 * - Box의 최신 트러블관리리스트(.xlsm/.xlsx)를 자동 선택
 * - Excel을 Google Sheets로 변환하지 않고 OpenXML을 직접 읽음
 * - Sheet1에서 section marker(◆...)와 실제 trouble row를 추출
 *
 * Required:
 * - Config.gs              : getRequiredProperty_()
 * - BoxAuth.gs             : getBoxAuthHeader_()
 * - BoxApi.gs              : boxDownloadFile_()
 *
 * Script Property:
 * - BOX_TROUBLE_LIST_FOLDER_ID
 *
 * Excel structure (verified sample):
 * A : section marker / 優先度
 * B : No.
 * E : 建屋
 * F : 装置ID
 * K : 依頼区分
 * L : アラームコード
 * M : アラーム名
 *
 * Alarm-name display rule:
 * - Full-width ASCII English/numbers/symbols -> half-width
 * - Japanese characters remain unchanged
 * =========================================================
 */


const TROUBLE_LIST_CONFIG_ =
  {
    folderProperty:
      'BOX_TROUBLE_LIST_FOLDER_ID',

    fileNameRegex:
      /トラブル管理リスト.*\.(?:xlsm|xlsx)$/i,

    sheetName:
      'Sheet1'
  };


/**
 * Web / backend public API.
 *
 * Returns a compact list for the selector:
 * No. / 装置ID / トラブル名
 */
function getTroubleJobOptions() {

  const source =
    getLatestTroubleListSource_();


  const rows =
    readTroubleJobsFromBoxFile_(
      source.id,
      source.name
    );


  return {
    ok:
      true,

    sourceFileId:
      source.id,

    sourceFileName:
      source.name,

    modifiedAt:
      source.modifiedAt,

    count:
      rows.length,

    jobs:
      rows.map(
        function(row) {

          return {
            jobKey:
              row.jobKey,

            no:
              row.no,

            machineId:
              row.machineId,

            troubleName:
              row.troubleName,

            building:
              row.building,

            requestType:
              row.requestType,

            alarmCode:
              row.alarmCode,

            environment:
              row.environment,

            equipmentModel:
              row.equipmentModel
          };
        }
      )
  };
}


/**
 * Reads the latest file again and resolves one exact job.
 * This prevents Web UI from trusting stale client-side row data.
 */
function getTroubleJobByKey(
  jobKey
) {

  const source =
    getLatestTroubleListSource_();


  const jobs =
    readTroubleJobsFromBoxFile_(
      source.id,
      source.name
    );


  const found =
    jobs.find(
      function(row) {

        return (
          String(
            row.jobKey
          )
          ===
          String(
            jobKey
          )
        );
      }
    );


  if (!found) {

    throw new Error(
      '선택한 트러블 작업을 최신 리스트에서 찾지 못했습니다. 화면을 새로고침 후 다시 선택하세요.'
    );
  }


  found.sourceFileId =
    source.id;


  found.sourceFileName =
    source.name;


  found.sourceModifiedAt =
    source.modifiedAt;


  return found;
}


/**
 * Latest trouble-list file in the configured Box folder.
 */
function getLatestTroubleListSource_() {

  const folderId =
    getRequiredProperty_(
      TROUBLE_LIST_CONFIG_
        .folderProperty
    );


  const items =
    listTroubleListFolderFiles_(
      folderId
    );


  const candidates =
    items
      .filter(
        function(item) {

          return (
            item.type
            ===
            'file'
            &&
            TROUBLE_LIST_CONFIG_
              .fileNameRegex
              .test(
                String(
                  item.name
                  ||
                  ''
                )
              )
            &&
            String(
              item.name
              ||
              ''
            )
              .indexOf(
                '~$'
              )
            !==
            0
          );
        }
      )
      .sort(
        function(a, b) {

          return (
            new Date(
              b.modified_at
              ||
              0
            )
              .getTime()
            -
            new Date(
              a.modified_at
              ||
              0
            )
              .getTime()
          );
        }
      );


  if (!candidates.length) {

    throw new Error(
      'BOX_TROUBLE_LIST_FOLDER_ID 폴더에서 트러블管理リスト(.xlsm/.xlsx)를 찾지 못했습니다.'
    );
  }


  const latest =
    candidates[
      0
    ];


  return {
    id:
      String(
        latest.id
      ),

    name:
      latest.name,

    modifiedAt:
      latest.modified_at
      ||
      ''
  };
}


function listTroubleListFolderFiles_(
  folderId
) {

  const all =
    [];


  let offset =
    0;


  const limit =
    1000;


  while (true) {

    const url =
      'https://api.box.com/2.0/folders/'
      +
      encodeURIComponent(
        folderId
      )
      +
      '/items?limit='
      +
      limit
      +
      '&offset='
      +
      offset
      +
      '&fields=id,type,name,modified_at,size';


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


    const status =
      response.getResponseCode();


    if (
      status
      !==
      200
    ) {

      throw new Error(
        [
          'Box Trouble List Folder 조회 실패',
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


    const entries =
      json.entries
      ||
      [];


    Array.prototype.push.apply(
      all,
      entries
    );


    offset +=
      entries.length;


    if (
      !entries.length
      ||
      offset
      >=
      Number(
        json.total_count
        ||
        0
      )
    ) {

      break;
    }
  }


  return all;
}


/**
 * Download Office OpenXML and parse the configured worksheet.
 */
function readTroubleJobsFromBoxFile_(
  fileId,
  fileName
) {

  const blob =
    boxDownloadFile_(
      fileId
    );


  const entries =
    unzipOfficeFile_(
      blob
    );


  const sharedStrings =
    parseSharedStrings_(
      entries
    );


  const sheetPath =
    resolveWorksheetPath_(
      entries,
      TROUBLE_LIST_CONFIG_
        .sheetName
    );


  const sheetBlob =
    entries[
      sheetPath
    ];


  if (!sheetBlob) {

    throw new Error(
      'Worksheet XML을 찾지 못했습니다: '
      +
      sheetPath
    );
  }


  const matrix =
    parseWorksheetMatrix_(
      sheetBlob.getDataAsString(
        'UTF-8'
      ),
      sharedStrings
    );


  return extractTroubleJobsFromMatrix_(
    matrix,
    fileName
  );
}


function unzipOfficeFile_(
  blob
) {

  const zipBlob =
    blob.copyBlob();


  zipBlob.setContentType(
    'application/zip'
  );


  let parts;


  try {

    parts =
      Utilities.unzip(
        zipBlob
      );
  }

  catch (error) {

    throw new Error(
      [
        'Excel OpenXML 압축 해제 실패',
        error
        &&
        error.message
          ? error.message
          : String(
              error
            )
      ].join(
        '\n'
      )
    );
  }


  const map =
    {};


  parts.forEach(
    function(part) {

      map[
        normalizeZipPath_(
          part.getName()
        )
      ] =
        part;
    }
  );


  return map;
}


function normalizeZipPath_(
  path
) {

  return String(
    path
    ||
    ''
  )
    .replace(
      /^\/+/,
      ''
    )
    .replace(
      /\\/g,
      '/'
    );
}


/**
 * Resolve sheet name -> worksheet XML target.
 */
function resolveWorksheetPath_(
  entries,
  sheetName
) {

  const workbook =
    entries[
      'xl/workbook.xml'
    ];


  const rels =
    entries[
      'xl/_rels/workbook.xml.rels'
    ];


  if (
    !workbook
    ||
    !rels
  ) {

    throw new Error(
      'xl/workbook.xml 또는 workbook.xml.rels가 없습니다.'
    );
  }


  const workbookDoc =
    XmlService.parse(
      workbook.getDataAsString(
        'UTF-8'
      )
    );


  const workbookRoot =
    workbookDoc.getRootElement();


  const mainNs =
    workbookRoot.getNamespace();


  const relNs =
    XmlService.getNamespace(
      'r',
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    );


  const sheets =
    workbookRoot
      .getChild(
        'sheets',
        mainNs
      )
      .getChildren(
        'sheet',
        mainNs
      );


  let relationId =
    '';


  sheets.some(
    function(sheet) {

      const nameAttr =
        sheet.getAttribute(
          'name'
        );


      if (
        nameAttr
        &&
        nameAttr.getValue()
        ===
        sheetName
      ) {

        const idAttr =
          sheet.getAttribute(
            'id',
            relNs
          );


        relationId =
          idAttr
            ? idAttr.getValue()
            : '';


        return true;
      }


      return false;
    }
  );


  if (!relationId) {

    throw new Error(
      'Worksheet를 찾지 못했습니다: '
      +
      sheetName
    );
  }


  const relDoc =
    XmlService.parse(
      rels.getDataAsString(
        'UTF-8'
      )
    );


  const relRoot =
    relDoc.getRootElement();


  const relChildren =
    relRoot.getChildren();


  let target =
    '';


  relChildren.some(
    function(rel) {

      const id =
        rel.getAttribute(
          'Id'
        );


      if (
        id
        &&
        id.getValue()
        ===
        relationId
      ) {

        const targetAttr =
          rel.getAttribute(
            'Target'
          );


        target =
          targetAttr
            ? targetAttr.getValue()
            : '';


        return true;
      }


      return false;
    }
  );


  if (!target) {

    throw new Error(
      'Worksheet relationship target을 찾지 못했습니다: '
      +
      relationId
    );
  }


  target =
    normalizeZipPath_(
      target
    );


  if (
    target.indexOf(
      'xl/'
    )
    !==
    0
  ) {

    target =
      'xl/'
      +
      target.replace(
        /^\.\//,
        ''
      );
  }


  return target;
}


function parseSharedStrings_(
  entries
) {

  const blob =
    entries[
      'xl/sharedStrings.xml'
    ];


  if (!blob) {

    return [];
  }


  const doc =
    XmlService.parse(
      blob.getDataAsString(
        'UTF-8'
      )
    );


  const root =
    doc.getRootElement();


  const ns =
    root.getNamespace();


  return root
    .getChildren(
      'si',
      ns
    )
    .map(
      function(si) {

        return collectTextNodes_(
          si,
          ns
        );
      }
    );
}


function collectTextNodes_(
  element,
  ns
) {

  let result =
    '';


  if (
    element.getName()
    ===
    't'
  ) {

    result +=
      element.getText();
  }


  element
    .getChildren()
    .forEach(
      function(child) {

        result +=
          collectTextNodes_(
            child,
            ns
          );
      }
    );


  return result;
}


/**
 * Converts worksheet XML into sparse row objects:
 * matrix[rowNumber][columnNumber] = value
 *
 * Column number is 1-based.
 */
function parseWorksheetMatrix_(
  xml,
  sharedStrings
) {

  const doc =
    XmlService.parse(
      xml
    );


  const root =
    doc.getRootElement();


  const ns =
    root.getNamespace();


  const sheetData =
    root.getChild(
      'sheetData',
      ns
    );


  if (!sheetData) {

    return {};
  }


  const matrix =
    {};


  sheetData
    .getChildren(
      'row',
      ns
    )
    .forEach(
      function(row) {

        const rowAttr =
          row.getAttribute(
            'r'
          );


        const rowNumber =
          rowAttr
            ? Number(
                rowAttr.getValue()
              )
            : 0;


        if (!rowNumber) {

          return;
        }


        const rowData =
          {};


        row
          .getChildren(
            'c',
            ns
          )
          .forEach(
            function(cell) {

              const refAttr =
                cell.getAttribute(
                  'r'
                );


              if (!refAttr) {

                return;
              }


              const ref =
                refAttr.getValue();


              const columnNumber =
                columnLettersToNumber_(
                  ref.replace(
                    /\d+/g,
                    ''
                  )
                );


              rowData[
                columnNumber
              ] =
                readOpenXmlCellValue_(
                  cell,
                  ns,
                  sharedStrings
                );
            }
          );


        matrix[
          rowNumber
        ] =
          rowData;
      }
    );


  return matrix;
}


function readOpenXmlCellValue_(
  cell,
  ns,
  sharedStrings
) {

  const typeAttr =
    cell.getAttribute(
      't'
    );


  const type =
    typeAttr
      ? typeAttr.getValue()
      : '';


  if (
    type
    ===
    'inlineStr'
  ) {

    const isNode =
      cell.getChild(
        'is',
        ns
      );


    return isNode
      ? collectTextNodes_(
          isNode,
          ns
        )
      : '';
  }


  const valueNode =
    cell.getChild(
      'v',
      ns
    );


  if (!valueNode) {

    return '';
  }


  const raw =
    valueNode.getText();


  if (
    type
    ===
    's'
  ) {

    const index =
      Number(
        raw
      );


    return (
      sharedStrings[
        index
      ]
      !==
      undefined
    )
      ? sharedStrings[
          index
        ]
      : '';
  }


  if (
    type
    ===
    'b'
  ) {

    return raw
      ===
      '1';
  }


  return raw;
}


function columnLettersToNumber_(
  letters
) {

  let result =
    0;


  String(
    letters
    ||
    ''
  )
    .toUpperCase()
    .split(
      ''
    )
    .forEach(
      function(ch) {

        result =
          result
          *
          26
          +
          (
            ch.charCodeAt(
              0
            )
            -
            64
          );
      }
    );


  return result;
}


/**
 * Trouble List business parsing.
 */
function extractTroubleJobsFromMatrix_(
  matrix,
  fileName
) {

  const jobs =
    [];


  let categoryRaw =
    '';


  const rowNumbers =
    Object.keys(
      matrix
    )
      .map(
        Number
      )
      .sort(
        function(a, b) {

          return a
          -
          b;
        }
      );


  rowNumbers.forEach(
    function(rowNumber) {

      const row =
        matrix[
          rowNumber
        ]
        ||
        {};


      const colA =
        cleanCellText_(
          row[
            1
          ]
        );


      if (
        colA.indexOf(
          '◆'
        )
        ===
        0
      ) {

        categoryRaw =
          colA;


        return;
      }


      const no =
        cleanCellText_(
          row[
            2
          ]
        );


      const machineId =
        cleanCellText_(
          row[
            6
          ]
        );


      const troubleNameRaw =
        cleanCellText_(
          row[
            13
          ]
        );


      const troubleName =
        normalizeTroubleDisplayText_(
          troubleNameRaw
        );


      /*
       * Header / blank row / irrelevant row.
       */
      if (
        !no
        ||
        no
        ===
        'No.'
        ||
        !machineId
        ||
        !troubleName
      ) {

        return;
      }


      const classification =
        classifyTroubleMachine_(
          categoryRaw,
          machineId
        );


      jobs.push(
        {
          jobKey:
            buildTroubleJobKey_(
              no,
              machineId,
              rowNumber
            ),

          rowNumber:
            rowNumber,

          no:
            no,

          priority:
            cleanCellText_(
              row[
                1
              ]
            ),

          building:
            cleanCellText_(
              row[
                5
              ]
            ),

          machineId:
            machineId,

          stopChannel:
            cleanCellText_(
              row[
                7
              ]
            ),

          requestType:
            cleanCellText_(
              row[
                11
              ]
            ),

          alarmCode:
            cleanCellText_(
              row[
                12
              ]
            ),

          troubleName:
            troubleName,

          troubleNameRaw:
            troubleNameRaw,

          categoryRaw:
            categoryRaw,

          environment:
            classification.environment,

          equipmentModel:
            classification.equipmentModel,

          classificationStatus:
            classification.status,

          sourceFileName:
            fileName
        }
      );
    }
  );


  return jobs;
}


function classifyTroubleMachine_(
  categoryRaw,
  machineId
) {

  const category =
    String(
      categoryRaw
      ||
      ''
    );


  const machine =
    String(
      machineId
      ||
      ''
    )
      .toUpperCase();


  if (
    category.indexOf(
      'F-REX300E'
    )
    !==
    -1
    ||
    category.indexOf(
      'EAC300BI-HV'
    )
    !==
    -1
  ) {

    if (
      machine.indexOf(
        'OBE'
      )
      ===
      0
    ) {

      return {
        environment:
          'BEVEL',

        equipmentModel:
          'EAC300bi-hv',

        status:
          'VERIFIED_RULE'
      };
    }


    if (
      machine.indexOf(
        'OFX'
      )
      ===
      0
    ) {

      return {
        environment:
          '300E',

        equipmentModel:
          'F-REX300E',

        status:
          'VERIFIED_RULE'
      };
    }
  }


  if (
    category.indexOf(
      'F-REX300X'
    )
    !==
    -1
    &&
    machine.indexOf(
      'OFX'
    )
    ===
    0
  ) {

    return {
      environment:
        '300X',

      equipmentModel:
        'F-REX300X',

      status:
        'VERIFIED_RULE'
    };
  }


  return {
    environment:
      'OTHER',

    equipmentModel:
      '',

    status:
      'REQUIRES_CONFIRMATION'
  };
}


function buildTroubleJobKey_(
  no,
  machineId,
  rowNumber
) {

  return [
    String(
      no
    ),
    String(
      machineId
    ),
    String(
      rowNumber
    )
  ]
    .join(
      '|'
    );
}


/**
 * Trouble-name display normalization.
 *
 * Goal:
 * - Full-width ASCII letters/digits/symbols -> half-width ASCII
 * - U+3000 full-width space -> normal space
 * - Japanese kana/kanji/middle-dot `・` remain unchanged
 *
 * Example:
 *   ＰＯＬＩ１・ステージ真空吸着タイムアウト
 *   -> POLI1・ステージ真空吸着タイムアウト
 *
 * Important:
 * This is NOT the device/trouble separator rule.
 * Document workTitle still joins:
 *   shortMachineId + single SPACE + normalized troubleName
 */
function normalizeTroubleDisplayText_(
  value
) {

  return String(
    value
    ||
    ''
  )
    .replace(
      /[\uFF01-\uFF5E]/g,
      function(ch) {

        return String.fromCharCode(
          ch.charCodeAt(
            0
          )
          -
          0xFEE0
        );
      }
    )
    .replace(
      /\u3000/g,
      ' '
    )
    .trim();
}


function cleanCellText_(
  value
) {

  if (
    value
    ===
    null
    ||
    value
    ===
    undefined
  ) {

    return '';
  }


  return String(
    value
  )
    .replace(
      /\u00A0/g,
      ' '
    )
    .trim();
}
