/**
 * =========================================================
 * STEP 5A Web API Test v3
 *
 * Validates:
 * - ReferenceDataService v5 all-section Worker scan
 * - Leader -> Worker qualification resolution
 * - manual PHS override
 * - leader cannot also be worker
 * - source-date workDate
 *
 * Required:
 * - TroubleListReader v6
 * - JobDataService v3
 * - ReferenceDataService v5
 * - WebAppApi v3
 * =========================================================
 */


function runStep5WebApiTest() {

  console.log(
    '=============================='
  );

  console.log(
    '[STEP 5A WEB API TEST v3] START'
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
  );


  console.log(
    '[WORK DATE] '
    +
    loaded.jobData.workDate
    +
    ' / source='
    +
    loaded.jobData.sourceTroubleFileName
  );


  const unresolved =
    loaded.leaderOptions
      .filter(
        function(leader) {

          return !leader.qualificationResolved;
        }
      )
      .map(
        function(leader) {

          return {
            name:
              leader.name,

            raw:
              leader.nameRaw,

            matchCount:
              leader.qualificationMatchCount
          };
        }
      );


  console.log(
    '[LEADER QUALIFICATION] resolved='
    +
    (
      loaded.leaderOptions.length
      -
      unresolved.length
    )
    +
    ' / unresolved='
    +
    unresolved.length
  );


  if (
    unresolved.length
  ) {

    console.log(
      '[UNRESOLVED LEADERS] '
      +
      JSON.stringify(
        unresolved,
        null,
        2
      )
    );
  }


  const leader =
    loaded.leaderOptions.find(
      function(item) {

        return item.qualificationResolved;
      }
    )
    ||
    loaded.leaderOptions[
      0
    ];


  if (!leader) {

    throw new Error(
      'Leader options=0'
    );
  }


  const workerCandidates =
    loaded.workerOptions.filter(
      function(worker) {

        return (
          !leader.workerKey
          ||
          worker.workerKey
          !==
          leader.workerKey
        );
      }
    );


  const selectedWorkers =
    workerCandidates
      .slice(
        0,
        2
      )
      .map(
        function(worker) {

          return worker.workerKey;
        }
      );


  const manualPhs =
    '99999';


  const draft =
    apiPrepareJobDraft(
      {
        jobKey:
          sample.jobKey,

        workDate:
          loaded.jobData.workDate,

        startTime:
          '10:00',

        repairTroubleMode:
          'REPAIR',

        leaderKey:
          leader.leaderKey,

        leaderPHS:
          manualPhs,

        workerKeys:
          selectedWorkers,

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
          loaded.jobData.oldSerial,

        workType:
          '修理',

        kyChecks:
          {
            D14:
              true,

            D20:
              true
          },

        simpleConsumables:
          {
            B33:
              '取り外し無し'
          }
      }
    );


  if (
    draft.draft.leaderPHS
    !==
    manualPhs
  ) {

    throw new Error(
      'Manual PHS override NG. actual='
      +
      draft.draft.leaderPHS
    );
  }


  console.log(
    '[DRAFT] '
    +
    JSON.stringify(
      {
        leader:
          draft.draft.leader,

        leaderPHS:
          draft.draft.leaderPHS,

        leaderQualifications:
          draft.draft.leaderQualifications,

        workers:
          draft.draft.workers.map(
            function(worker) {

              return {
                name:
                  worker.name,

                attendanceCell:
                  worker.attendanceCell
              };
            }
          ),

        workType:
          draft.draft.workType,

        kyChecks:
          draft.draft.kyChecks,

        simpleConsumables:
          draft.draft.simpleConsumables
      },
      null,
      2
    )
  );


  /*
   * Negative test:
   * a resolved leader must not be selectable as worker.
   */
  if (
    leader.workerKey
  ) {

    let blocked =
      false;


    try {

      apiPrepareJobDraft(
        {
          jobKey:
            sample.jobKey,

          workDate:
            loaded.jobData.workDate,

          startTime:
            '10:00',

          repairTroubleMode:
            'REPAIR',

          leaderKey:
            leader.leaderKey,

          leaderPHS:
            manualPhs,

          workerKeys:
            [
              leader.workerKey
            ]
        }
      );
    }

    catch (error) {

      blocked =
        String(
          error.message
          ||
          error
        )
          .indexOf(
            '職長と同じ人物'
          )
        !==
        -1;
    }


    if (!blocked) {

      throw new Error(
        'Leader=Worker guard NG'
      );
    }
  }


  console.log(
    '=============================='
  );

  console.log(
    '[STEP 5A WEB API TEST v3] RESULT = OK'
  );

  console.log(
    '=============================='
  );


  return draft;
}
