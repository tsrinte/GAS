/**
 * =========================================================
 * JobDataService v2
 *
 * STEP 4A:
 * Trouble List의 선택 row를 문서자동화용 BASE_JOB_DATA로 변환.
 *
 * IMPORTANT:
 * - 아직 Info2026 / Worker Master enrichment 전 단계임.
 * - JOB_DATA_READY는 다음 STEP에서 Info2026 + Worker Master를
 *   합친 뒤 사용.
 * =========================================================
 */


/**
 * Web public API.
 * jobKey로 최신 Trouble List를 다시 조회하고 base job data 생성.
 */
function loadBaseJobData(
  jobKey
) {

  const trouble =
    getTroubleJobByKey(
      jobKey
    );


  const now =
    new Date();


  const workDate =
    Utilities.formatDate(
      now,
      'Asia/Tokyo',
      'yyyy-MM-dd'
    );


  const base =
    {
      dataState:
        'JOB_SELECTED',

      jobKey:
        trouble.jobKey,

      sourceTroubleFileId:
        trouble.sourceFileId,

      sourceTroubleFileName:
        trouble.sourceFileName,

      sourceTroubleModifiedAt:
        trouble.sourceModifiedAt,

      troubleNo:
        trouble.no,

      categoryRaw:
        trouble.categoryRaw,

      building:
        trouble.building,

      machineId:
        trouble.machineId,

      environment:
        trouble.environment,

      equipmentModel:
        trouble.equipmentModel,

      classificationStatus:
        trouble.classificationStatus,

      requestType:
        trouble.requestType,

      alarmCode:
        trouble.alarmCode,

      troubleName:
        trouble.troubleName,

      troubleNameRaw:
        trouble.troubleNameRaw
        ||
        trouble.troubleName,

      workTitle:
        buildDocumentWorkTitle_(
          trouble.machineId,
          trouble.troubleName
        ),

      workDate:
        workDate,

      startTime:
        '10:00',

      /*
       * Emerg PDF에서는 종료시각을 사용하지 않음.
       */
      endTime:
        '',

      /*
       * Web에서 반드시 선택.
       * Trouble List의 依頼区分으로 자동 결정하지 않음.
       */
      repairTroubleMode:
        '',

      /*
       * STEP 4B enrichment targets
       */
      workLocation:
        '',

      serialNo:
        '',

      oldSerial:
        '',

      leader:
        '',

      leaderPHS:
        '',

      writer:
        '',

      leaderQualifications:
        {},

      workers:
        [],

      emergEnabled:
        true,

      kyChecks:
        {},

      emergCategories:
        {},

      simpleConsumables:
        {},

      warnings:
        []
    };


  if (
    base.classificationStatus
    ===
    'REQUIRES_CONFIRMATION'
  ) {

    base.warnings.push(
      '装置環境を自動判定できません。300X / 300E / BEVEL / OTHER を確認してください。'
    );
  }


  return base;
}


/**
 * Document work title:
 *
 * OBEV504 + ＰＯＬＩ１・ステージ真空吸着タイムアウト
 * -> V504 POLI1・ステージ真空吸着タイムアウト
 *
 * OFXC709 + Alarm...
 * -> C709 Alarm...
 *
 * No underscore separator.
 */
function buildDocumentWorkTitle_(
  machineId,
  troubleName
) {

  const shortMachineId =
    String(
      machineId
      ||
      ''
    )
      .trim()
      .replace(
        /^(?:OFX|OBE)/i,
        ''
      );


  const alarmName =
    String(
      troubleName
      ||
      ''
    )
      .trim();


  return [
    shortMachineId,
    alarmName
  ]
    .filter(
      function(value) {

        return Boolean(
          value
        );
      }
    )
    .join(
      ' '
    );
}


/**
 * Web selector display value.
 */
function makeJobSelectorLabel_(
  job,
  mode
) {

  const key =
    String(
      mode
      ||
      'NO'
    )
      .toUpperCase();


  if (
    key
    ===
    'MACHINE'
  ) {

    return (
      job.machineId
      +
      ' | No.'
      +
      job.no
      +
      ' | '
      +
      job.troubleName
    );
  }


  if (
    key
    ===
    'TROUBLE'
  ) {

    return (
      job.troubleName
      +
      ' | '
      +
      job.machineId
      +
      ' | No.'
      +
      job.no
    );
  }


  return (
    'No.'
    +
    job.no
    +
    ' | '
    +
    job.machineId
    +
    ' | '
    +
    job.troubleName
  );
}
