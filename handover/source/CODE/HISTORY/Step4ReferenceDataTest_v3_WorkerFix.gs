/**
 * =========================================================
 * STEP 4B Reference Data Test v3 Worker Fix
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
    '[STEP 4B REFERENCE DATA TEST v3] START'
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


  /*
   * Current shared Worker Master known sample:
   * row24 E:F merged = 加茂　雅之
   * row23 I:J:K:L    = あり / あり / あり / あり
   *
   * Display must be surname-only: 加茂
   */
  const kamo =
    payload.workerOptions.find(
      function(worker) {

        return (
          worker.name
          ===
          '加茂'
        );
      }
    );


  if (kamo) {

    console.log(
      '[WORKER KNOWN SAMPLE] '
      +
      JSON.stringify(
        kamo
      )
    );


    if (
      !kamo.qualifications.gas
      ||
      !kamo.qualifications.electric
      ||
      !kamo.qualifications.leader
      ||
      !kamo.qualifications.law60
    ) {

      throw new Error(
        'Worker qualification mapping NG for 加茂'
      );
    }
  }

  else {

    console.log(
      '[WARN] Known sample 加茂 not found in latest Worker Master.'
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
    '[STEP 4B REFERENCE DATA TEST v3] RESULT = OK'
  );

  console.log(
    '=============================='
  );


  return payload;
}
