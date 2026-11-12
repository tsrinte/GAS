/**
 * =========================================================
 * STEP 4B Reference Data Test v2 FAST
 *
 * Validates:
 * - Trouble List cache
 * - Info2026 exact sheets only:
 *   装置情報 / 職長_PHS
 * - requested machineId only from 装置情報
 * - Worker Master fast reader
 * - JOB_DATA_READY
 *
 * Required:
 * - TroubleListReader v6
 * - JobDataService v2
 * - ReferenceDataService v2 FAST
 * =========================================================
 */


function runStep4ReferenceDataTest() {

  const totalStartedAt =
    Date.now();


  console.log(
    '=============================='
  );

  console.log(
    '[STEP 4B REFERENCE DATA TEST v2 FAST] START'
  );

  console.log(
    '=============================='
  );


  const troubleStartedAt =
    Date.now();


  const trouble =
    getTroubleJobOptions();


  console.log(
    '[TEST TIMING] Trouble options / ms='
    +
    (
      Date.now()
      -
      troubleStartedAt
    )
  );


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


  const refStartedAt =
    Date.now();


  const payload =
    getReferenceDataForJob(
      sample.jobKey
    );


  console.log(
    '[TEST TIMING] Reference load / ms='
    +
    (
      Date.now()
      -
      refStartedAt
    )
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
    '[REFERENCE]'
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


  if (
    sample.machineId
    ===
    'OBEV504'
  ) {

    console.log(
      '[KNOWN SAMPLE DEVICE] found='
      +
      payload.reference.info2026.deviceFound
      +
      ' / serialNo='
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


  console.log(
    '[TEST TIMING] TOTAL / ms='
    +
    (
      Date.now()
      -
      totalStartedAt
    )
  );


  console.log(
    '=============================='
  );

  console.log(
    '[STEP 4B REFERENCE DATA TEST v2 FAST] RESULT = OK'
  );

  console.log(
    '=============================='
  );


  return payload;
}
