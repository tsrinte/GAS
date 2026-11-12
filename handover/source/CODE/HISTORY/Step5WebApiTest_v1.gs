/**
 * =========================================================
 * STEP 5A Web API Test v1
 * =========================================================
 */


function runStep5WebApiTest() {

  console.log(
    '=============================='
  );

  console.log(
    '[STEP 5A WEB API TEST] START'
  );

  console.log(
    '=============================='
  );


  const bootstrap =
    apiBootstrap();


  if (
    !bootstrap.jobs.length
  ) {

    throw new Error(
      'Web bootstrap jobs=0'
    );
  }


  console.log(
    '[BOOTSTRAP] jobs='
    +
    bootstrap.jobs.length
    +
    ' / ms='
    +
    bootstrap.elapsedMs
  );


  const sample =
    bootstrap.jobs.find(
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
    bootstrap.jobs[
      0
    ];


  const loaded =
    apiLoadJob(
      sample.jobKey
    );


  console.log(
    '[LOAD JOB] leaders='
    +
    loaded.leaderOptions.length
    +
    ' / workers='
    +
    loaded.workerOptions.length
    +
    ' / ms='
    +
    loaded.elapsedMs
  );


  if (
    !loaded.leaderOptions.length
  ) {

    throw new Error(
      'Leader options=0'
    );
  }


  if (
    !loaded.workerOptions.length
  ) {

    throw new Error(
      'Worker options=0'
    );
  }


  const draft =
    apiPrepareJobDraft(
      {
        jobKey:
          sample.jobKey,

        workDate:
          loaded.jobData.workDate,

        startTime:
          loaded.jobData.startTime,

        repairTroubleMode:
          'REPAIR',

        leaderKey:
          loaded.leaderOptions[
            0
          ]
            .leaderKey,

        workerKeys:
          loaded.workerOptions
            .slice(
              0,
              2
            )
            .map(
              function(worker) {

                return worker.workerKey;
              }
            ),

        environment:
          loaded.jobData.environment,

        equipmentModel:
          loaded.jobData.equipmentModel,

        workTitle:
          loaded.jobData.workTitle,

        customerName:
          loaded.jobData.customerName,

        workLocation:
          loaded.jobData.workLocation,

        serialNo:
          loaded.jobData.serialNo,

        oldSerial:
          loaded.jobData.oldSerial
      }
    );


  if (
    draft.state
    !==
    'EDITING'
  ) {

    throw new Error(
      'Draft state expected=EDITING actual='
      +
      draft.state
    );
  }


  if (
    draft.draft.repairTroubleMode
    !==
    'REPAIR'
  ) {

    throw new Error(
      'repairTroubleMode NG'
    );
  }


  console.log(
    '[DRAFT] '
    +
    JSON.stringify(
      {
        workTitle:
          draft.draft.workTitle,

        leader:
          draft.draft.leader,

        leaderPHS:
          draft.draft.leaderPHS,

        workerCount:
          draft.draft.workers.length,

        repairTroubleMode:
          draft.draft.repairTroubleMode,

        warnings:
          draft.warnings
      },
      null,
      2
    )
  );


  console.log(
    '=============================='
  );

  console.log(
    '[STEP 5A WEB API TEST] RESULT = OK'
  );

  console.log(
    '=============================='
  );


  return draft;
}
