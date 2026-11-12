/**
 * =========================================================
 * STEP 4A Trouble Reader Test v2
 *
 * 목적:
 * - Box 최신 Trouble List 자동선택
 * - OpenXML parser 정상동작
 * - No.1837 / OBEV504 business mapping 검증
 * - workTitle에 underscore가 없는지 검증
 *
 * Required Script Property:
 * - BOX_TROUBLE_LIST_FOLDER_ID
 * =========================================================
 */


function runStep4TroubleReaderTest() {

  console.log(
    '=============================='
  );

  console.log(
    '[STEP 4A TROUBLE READER TEST] START'
  );

  console.log(
    '=============================='
  );


  const normalizedAlarm =
    normalizeTroubleDisplayText_(
      'ＰＯＬＩ１・ステージ真空吸着タイムアウト'
    );


  const expectedNormalizedAlarm =
    'POLI1・ステージ真空吸着タイムアウト';


  if (
    normalizedAlarm
    !==
    expectedNormalizedAlarm
  ) {

    throw new Error(
      [
        'Alarm width normalization NG',
        'actual   = '
        +
        normalizedAlarm,
        'expected = '
        +
        expectedNormalizedAlarm
      ].join(
        '\n'
      )
    );
  }


  console.log(
    '[ALARM NORMALIZE] OK : '
    +
    normalizedAlarm
  );


  const response =
    getTroubleJobOptions();


  console.log(
    'Source File : '
    +
    response.sourceFileName
  );


  console.log(
    'Modified    : '
    +
    response.modifiedAt
  );


  console.log(
    'Job Count   : '
    +
    response.count
  );


  if (
    !response.count
  ) {

    throw new Error(
      'Trouble job가 0건입니다.'
    );
  }


  /*
   * Sample workbook verified row:
   * No.1837 / OBEV504
   */
  const target =
    response.jobs.find(
      function(job) {

        return (
          String(
            job.no
          )
          ===
          '1837'
          &&
          String(
            job.machineId
          )
          ===
          'OBEV504'
        );
      }
    );


  if (target) {

    console.log(
      '------------------------------'
    );

    console.log(
      '[KNOWN SAMPLE] FOUND'
    );

    console.log(
      JSON.stringify(
        target,
        null,
        2
      )
    );


    if (
      target.environment
      !==
      'BEVEL'
    ) {

      throw new Error(
        'No.1837 environment expected=BEVEL actual='
        +
        target.environment
      );
    }


    if (
      target.equipmentModel
      !==
      'EAC300bi-hv'
    ) {

      throw new Error(
        'No.1837 model expected=EAC300bi-hv actual='
        +
        target.equipmentModel
      );
    }


    const base =
      loadBaseJobData(
        target.jobKey
      );


    console.log(
      '------------------------------'
    );

    console.log(
      '[BASE JOB DATA]'
    );

    console.log(
      JSON.stringify(
        base,
        null,
        2
      )
    );


    if (
      base.workTitle.indexOf(
        '_'
      )
      !==
      -1
    ) {

      throw new Error(
        'workTitle에 underscore가 포함되어 있습니다: '
        +
        base.workTitle
      );
    }


    if (
      base.workTitle.indexOf(
        'V504 '
      )
      !==
      0
    ) {

      throw new Error(
        'workTitle prefix 제거 규칙 NG: '
        +
        base.workTitle
      );
    }
  }

  else {

    console.log(
      '[WARN] No.1837 / OBEV504는 최신 파일에 존재하지 않습니다.'
    );


    const first =
      response.jobs[
        0
      ];


    const base =
      loadBaseJobData(
        first.jobKey
      );


    console.log(
      '[FIRST JOB FALLBACK]'
    );

    console.log(
      JSON.stringify(
        base,
        null,
        2
      )
    );
  }


  console.log(
    '=============================='
  );

  console.log(
    '[STEP 4A TROUBLE READER TEST v2] RESULT = OK'
  );

  console.log(
    '=============================='
  );


  return response;
}
