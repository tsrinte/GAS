/**
 * =========================================================
 * WebAppApi v2
 *
 * STEP 5A:
 * - Trouble List job selector
 * - Info2026 / Worker Master load
 * - JOB_DATA draft preparation
 *
 * State:
 * INIT
 *   -> JOB_SELECTED
 *   -> JOB_DATA_READY
 *   -> EDITING
 *
 * Requires:
 * - TroubleListReader v6
 * - JobDataService v2
 * - ReferenceDataService v4
 * =========================================================
 */


function apiBootstrap() {

  const startedAt =
    Date.now();


  const trouble =
    getTroubleJobOptions();


  return {
    ok:
      true,

    state:
      'INIT',

    source:
      {
        fileId:
          trouble.sourceFileId,

        fileName:
          trouble.sourceFileName,

        modifiedAt:
          trouble.modifiedAt
      },

    count:
      trouble.count,

    jobs:
      trouble.jobs,

    elapsedMs:
      Date.now()
      -
      startedAt
  };
}


function apiLoadJob(
  jobKey
) {

  if (!jobKey) {

    throw new Error(
      '作業を選択してください。'
    );
  }


  const startedAt =
    Date.now();


  const payload =
    getReferenceDataForJob(
      jobKey
    );


  return {
    ok:
      true,

    state:
      'JOB_DATA_READY',

    jobData:
      payload.jobData,

    leaderOptions:
      payload.leaderOptions,

    workerOptions:
      payload.workerOptions,

    reference:
      payload.reference,

    elapsedMs:
      Date.now()
      -
      startedAt
  };
}


/**
 * Build one server-trusted draft from Web inputs.
 *
 * Client sends only keys + editable override values.
 * Leader/worker qualification objects are re-resolved on server.
 */
function apiPrepareJobDraft(
  input
) {

  input =
    input
    ||
    {};


  const jobKey =
    String(
      input.jobKey
      ||
      ''
    )
      .trim();


  if (!jobKey) {

    throw new Error(
      '作業が選択されていません。'
    );
  }


  const repairTroubleMode =
    String(
      input.repairTroubleMode
      ||
      ''
    )
      .trim()
      .toUpperCase();


  if (
    repairTroubleMode
    !==
    'REPAIR'
    &&
    repairTroubleMode
    !==
    'TROUBLE'
  ) {

    throw new Error(
      '「修理」または「トラブル」を選択してください。'
    );
  }


  const workDate =
    String(
      input.workDate
      ||
      ''
    )
      .trim();


  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      workDate
    )
  ) {

    throw new Error(
      '作業日を確認してください。'
    );
  }


  const startTime =
    String(
      input.startTime
      ||
      ''
    )
      .trim();


  if (
    !/^\d{2}:\d{2}$/.test(
      startTime
    )
  ) {

    throw new Error(
      '開始時刻を確認してください。'
    );
  }


  const reference =
    getReferenceDataForJob(
      jobKey
    );


  const base =
    reference.jobData;


  const warnings =
    []
      .concat(
        base.warnings
        ||
        []
      );


  /*
   * ---------------------------------------------------------
   * Leader
   * ---------------------------------------------------------
   */

  const leaderKey =
    String(
      input.leaderKey
      ||
      ''
    )
      .trim();


  if (!leaderKey) {

    throw new Error(
      '職長を選択してください。'
    );
  }


  const leader =
    reference.leaderOptions.find(
      function(item) {

        return (
          String(
            item.leaderKey
          )
          ===
          leaderKey
        );
      }
    );


  if (!leader) {

    throw new Error(
      '選択した職長を最新データから確認できません。再読込してください。'
    );
  }


  const sourceLeaderPHS =
    String(
      leader.phs
      ||
      '-'
    )
      .trim();


  const manualLeaderPHS =
    String(
      input.leaderPHS
      ||
      ''
    )
      .trim();


  let effectiveLeaderPHS =
    sourceLeaderPHS;


  if (
    !sourceLeaderPHS
    ||
    sourceLeaderPHS
    ===
    '-'
  ) {

    if (!manualLeaderPHS) {

      throw new Error(
        '職長PHSが未登録です。PHSを入力してください。'
      );
    }


    effectiveLeaderPHS =
      manualLeaderPHS;
  }


  const leaderQualificationResult =
    {
      qualifications:
        leader.qualifications
        ||
        {},

      workerKey:
        leader.workerKey
        ||
        '',

      resolved:
        Boolean(
          leader.qualificationResolved
        )
    };


  if (
    !leaderQualificationResult.resolved
  ) {

    warnings.push(
      '職長資格をWorker Masterと一意に照合できませんでした。資格表示は未確定です。'
    );
  }


  /*
   * ---------------------------------------------------------
   * Workers 1..6
   * ---------------------------------------------------------
   */

  const workerKeys =
    Array.isArray(
      input.workerKeys
    )
      ? input.workerKeys
      : [];


  const selectedWorkerKeys =
    workerKeys
      .map(
        function(value) {

          return String(
            value
            ||
            ''
          )
            .trim();
        }
      )
      .filter(
        function(value) {

          return Boolean(
            value
          );
        }
      );


  if (
    leaderQualificationResult.workerKey
    &&
    selectedWorkerKeys.indexOf(
      leaderQualificationResult.workerKey
    )
    !==
    -1
  ) {

    throw new Error(
      '職長と同じ人物を作業者に選択できません。'
    );
  }


  if (
    selectedWorkerKeys.length
    >
    6
  ) {

    throw new Error(
      '作業者は最大6名です。'
    );
  }


  const uniqueWorkerKeys =
    Array.from(
      new Set(
        selectedWorkerKeys
      )
    );


  if (
    uniqueWorkerKeys.length
    !==
    selectedWorkerKeys.length
  ) {

    throw new Error(
      '同じ作業者が重複して選択されています。'
    );
  }


  const workers =
    selectedWorkerKeys.map(
      function(workerKey) {

        const worker =
          reference.workerOptions.find(
            function(item) {

              return (
                String(
                  item.workerKey
                )
                ===
                workerKey
              );
            }
          );


        if (!worker) {

          throw new Error(
            '選択した作業者を最新データから確認できません: '
            +
            workerKey
          );
        }


        if (
          !leaderQualificationResult.workerKey
          &&
          String(
            worker.name
            ||
            ''
          )
          ===
          String(
            leader.name
            ||
            ''
          )
        ) {

          throw new Error(
            '職長と同じ名前の人物を作業者に選択できません。'
          );
        }


        return {
          workerKey:
            worker.workerKey,

          name:
            worker.name,

          fullName:
            worker.fullName
            ||
            worker.name,

          phs:
            worker.phs
            ||
            '-',

          qualifications:
            worker.qualifications
            ||
            {},

          attendanceCell:
            worker.attendanceCell
            ||
            ''
        };
      }
    );


  /*
   * ---------------------------------------------------------
   * Editable AUTO -> OVERRIDE fields
   * ---------------------------------------------------------
   */

  const draft =
    Object.assign(
      {},
      base,
      {
        dataState:
          'EDITING',

        workDate:
          workDate,

        startTime:
          startTime,

        endTime:
          '',

        repairTroubleMode:
          repairTroubleMode,

        environment:
          useOverride_(
            input.environment,
            base.environment
          ),

        equipmentModel:
          useOverride_(
            input.equipmentModel,
            base.equipmentModel
          ),

        workTitle:
          useOverride_(
            input.workTitle,
            base.workTitle
          ),

        customerName:
          useOverride_(
            input.customerName,
            base.customerName
          ),

        workLocation:
          useOverride_(
            input.workLocation,
            base.workLocation
          ),

        serialNo:
          useOverride_(
            input.serialNo,
            base.serialNo
          ),

        oldSerial:
          useOverride_(
            input.oldSerial,
            base.oldSerial
          ),

        leader:
          leader.name,

        leaderPHS:
          effectiveLeaderPHS,

        leaderQualifications:
          leaderQualificationResult.qualifications,

        workers:
          workers,

        warnings:
          warnings
      }
    );


  return {
    ok:
      true,

    state:
      'EDITING',

    draft:
      draft,

    warnings:
      warnings
  };
}


function useOverride_(
  incoming,
  fallback
) {

  const value =
    String(
      incoming
      ===
      null
      ||
      incoming
      ===
      undefined
        ? ''
        : incoming
    )
      .trim();


  return value
    ? value
    : String(
        fallback
        ||
        ''
      );
}
