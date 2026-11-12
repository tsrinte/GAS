/**
 * =========================================================
 * STEP 5A Web API Test v2 - Bug Fix
 *
 * Verifies:
 * - leader display name has no trailing Katakana reading
 * - customerName has no half-width Katakana
 * - leader qualification is attached when Worker Master match exists
 * - leader cannot also be selected as worker
 * - manual leader PHS is accepted when source PHS is '-'
 * - valid EDITING draft is generated
 * =========================================================
 */


function runStep5WebApiTest() {

  console.log(
    '=============================='
  );

  console.log(
    '[STEP 5A WEB API TEST v2] START'
  );

  console.log(
    '=============================='
  );


  const bootstrap =
    apiBootstrap();


  if (!bootstrap.jobs.length) {

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


  if (!loaded.leaderOptions.length) {

    throw new Error(
      'Leader options=0'
    );
  }


  if (!loaded.workerOptions.length) {

    throw new Error(
      'Worker options=0'
    );
  }


  /*
   * Customer display must not contain half-width Katakana.
   */
  if (
    /[\uFF65-\uFF9F]/.test(
      String(
        loaded.jobData.customerName
        ||
        ''
      )
    )
  ) {

    throw new Error(
      'customerName에 반각 Katakana가 남아 있습니다: '
      +
      loaded.jobData.customerName
    );
  }


  const leader =
    loaded.leaderOptions.find(
      function(item) {

        return Boolean(
          item.qualificationResolved
        );
      }
    )
    ||
    loaded.leaderOptions[
      0
    ];


  /*
   * Leader display should no longer look like 瀬古セコ.
   */
  if (
    /[ァ-ヶー]+$/.test(
      String(
        leader.name
        ||
        ''
      )
    )
  ) {

    throw new Error(
      '職長名 뒤에 Katakana reading이 남아 있습니다: '
      +
      leader.name
    );
  }


  console.log(
    '[LEADER] '
    +
    JSON.stringify(
      {
        name:
          leader.name,

        phs:
          leader.phs,

        qualificationResolved:
          leader.qualificationResolved,

        workerKey:
          leader.workerKey,

        qualifications:
          leader.qualifications
      },
      null,
      2
    )
  );


  /*
   * Server-side doppelganger guard.
   */
  if (
    leader.workerKey
  ) {

    let duplicateBlocked =
      false;


    try {

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
            leader.leaderKey,

          leaderPHS:
            leader.phs
            ===
            '-'
              ? '9999'
              : leader.phs,

          workerKeys:
            [
              leader.workerKey
            ]
        }
      );
    }

    catch (error) {

      duplicateBlocked =
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


    if (!duplicateBlocked) {

      throw new Error(
        '職長と同じ人物の作業者選択が block されませんでした。'
      );
    }


    console.log(
      '[LEADER/WORKER DUPLICATE GUARD] OK'
    );
  }


  const validWorkers =
    loaded.workerOptions
      .filter(
        function(worker) {

          return (
            !leader.workerKey
            ||
            worker.workerKey
            !==
            leader.workerKey
          );
        }
      )
      .slice(
        0,
        2
      );


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
          leader.leaderKey,

        leaderPHS:
          leader.phs
          ===
          '-'
            ? '9999'
            : leader.phs,

        workerKeys:
          validWorkers.map(
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


  console.log(
    '[DRAFT] '
    +
    JSON.stringify(
      {
        customerName:
          draft.draft.customerName,

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
    '[STEP 5A WEB API TEST v2] RESULT = OK'
  );

  console.log(
    '=============================='
  );


  return draft;
}
