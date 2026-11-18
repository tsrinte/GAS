/**
 * =========================================================
 * STEP 4B Reference Data Test v1
 *
 * Required Script Properties:
 * - BOX_TROUBLE_LIST_FOLDER_ID
 * - BOX_INFO2026_FILE_ID
 * - BOX_WORKER_MASTER_FOLDER_ID
 *
 * Required code:
 * - TroubleListReader v6
 * - JobDataService v2
 * - ReferenceDataService v1
 * =========================================================
 */


function runStep4ReferenceDataTest() {

  console.log(
    '=============================='
  );

  console.log(
    '[STEP 4B REFERENCE DATA TEST] START'
  );

  console.log(
    '=============================='
  );


  const trouble =
    getTroubleJobOptions();


  if (
    !trouble.jobs.length
  ) {

    throw new Error(
      'Trouble job가 0건입니다.'
    );
  }


  const sample =
    trouble.jobs.find(
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
    )
    ||
    trouble.jobs[
      0
    ];


  console.log(
    '[TEST JOB] '
    +
    sample.jobKey
  );


  const payload =
    getReferenceDataForJob(
      sample.jobKey
    );


  console.log(
    '[JOB DATA]'
  );


  console.log(
    JSON.stringify(
      payload.jobData,
      null,
      2
    )
  );


  console.log(
    '[REFERENCE COUNTS]'
  );


  console.log(
    JSON.stringify(
      payload.reference,
      null,
      2
    )
  );


  console.log(
    '[LEADER OPTIONS] count='
    +
    payload.leaderOptions.length
  );


  console.log(
    '[WORKER OPTIONS] count='
    +
    payload.workerOptions.length
  );


  if (
    payload.dataState
    !==
    'JOB_DATA_READY'
  ) {

    throw new Error(
      'dataState expected=JOB_DATA_READY actual='
      +
      payload.dataState
    );
  }


  if (
    !payload.reference.info2026.deviceCount
  ) {

    throw new Error(
      'Info2026 装置情報가 0건입니다.'
    );
  }


  if (
    !payload.reference.info2026.leaderCount
  ) {

    throw new Error(
      'Info2026 職長_PHS가 0건입니다.'
    );
  }


  if (
    !payload.reference.workerMaster.workerCount
  ) {

    throw new Error(
      'Worker Master 유효 작업자가 0명입니다.'
    );
  }


  /*
   * OBEV504 is BEVEL in the known Trouble sample.
   * If the live Info2026 contains this device, show resolved values.
   * Missing device is a warning rather than a fatal error because
   * source revisions may differ during development.
   */
  if (
    sample.machineId
    ===
    'OBEV504'
  ) {

    console.log(
      '[KNOWN SAMPLE DEVICE] serialNo='
      +
      (
        payload.jobData.serialNo
        ||
        '<NOT_FOUND>'
      )
      +
      ' / workLocation='
      +
      (
        payload.jobData.workLocation
        ||
        '<NOT_FOUND>'
      )
    );
  }


  if (
    payload.workerOptions.length
  ) {

    console.log(
      '[WORKER SAMPLE]'
    );


    console.log(
      JSON.stringify(
        payload.workerOptions[
          0
        ],
        null,
        2
      )
    );
  }


  if (
    payload.leaderOptions.length
  ) {

    console.log(
      '[LEADER SAMPLE]'
    );


    console.log(
      JSON.stringify(
        payload.leaderOptions[
          0
        ],
        null,
        2
      )
    );
  }


  console.log(
    '=============================='
  );

  console.log(
    '[STEP 4B REFERENCE DATA TEST] RESULT = OK'
  );

  console.log(
    '=============================='
  );


  return payload;
}
