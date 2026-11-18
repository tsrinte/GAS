/**
 * Emerg PDF Production Integration Test v2
 *
 * Validates the actual production path after:
 * - Work-date border-safe whiteout
 * - Start-time-only work-date output
 * - PHS 1.0pt upward field correction
 * - Global Meiryo vertical calibration 3.8pt
 *
 * Requires:
 * - PdfOverlayCoordinateMap_v9.gs
 * - PdfRuntimeLoader.gs
 * - PdfOverlayService.gs (v10 Date/PHS Fix)
 * - BOX_TEST_FOLDER_ID
 */
async function runEmergPdfProductionTest() {

  const testFolderId =
    getRequiredProperty_(
      'BOX_TEST_FOLDER_ID'
    );


  const jobData =
    {
      machineId:
        'OBEV504',

      troubleName:
        'POLI1 Sensor Error',

      workLocation:
        '230棟',

      workDate:
        '2026-09-27',

      startTime:
        '10:00',

      /*
       * endTime is intentionally omitted.
       * Output must be:
       * 2026年9月27日  (10時00分 ～        )
       */
      repairTroubleMode:
        'REPAIR',

      leader:
        '山田',

      leaderPHS:
        '1234',

      leaderQualifications:
        {
          law60:
            true,

          leader:
            true,

          electric:
            false,

          gas:
            true
        },

      workers:
        [
          {
            name:
              '佐藤',

            phs:
              '1001',

            qualifications:
              {
                law60:
                  true,

                leader:
                  true,

                electric:
                  false,

                gas:
                  false
              }
          },

          {
            name:
              '鈴木',

            phs:
              '1002',

            qualifications:
              {
                law60:
                  false,

                leader:
                  false,

                electric:
                  true,

                gas:
                  false
              }
          }
        ]
    };


  const expectedDateText =
    '2026年9月27日  (10時00分 ～        )';


  const actualDateText =
    buildEmergWorkDateText_(
      jobData
    );


  if (
    actualDateText
    !==
    expectedDateText
  ) {

    throw new Error(
      [
        'Work-date formatting NG',
        'actual   = '
        +
        actualDateText,
        'expected = '
        +
        expectedDateText
      ].join(
        '\n'
      )
    );
  }


  console.log(
    '[DATE FORMAT] OK : '
    +
    actualDateText
  );


  console.log(
    '=============================='
  );

  console.log(
    '[EMERG PRODUCTION TEST v2] START'
  );

  console.log(
    '=============================='
  );


  const result =
    await generateEmergPdfOverlayToBox(
      jobData,
      testFolderId
    );


  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  console.log(
    '=============================='
  );

  console.log(
    '[EMERG PRODUCTION TEST v2] RESULT = OK'
  );

  console.log(
    '=============================='
  );


  return result;
}
