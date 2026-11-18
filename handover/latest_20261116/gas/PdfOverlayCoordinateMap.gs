/**
 * Emerg PDF Overlay Coordinate Map v12  (2026-11-15, base = v11)
 * v12 (only): 縦位置の固定 3.8pt 下げ補正と PHS の個別補正を廃止 (PdfOverlayService v12.3 がインク中央で揃える)。
 *
 * ---- v11 ----
 * v11 (only): 作業名 / 装置ID / 作業場所 / 職長名 を横方向中央揃え (xRange 内)。
 *   xRange は Emerg_Master_Blank_v2.pdf の罫線 (ベクター線) から抽出した値:
 *     作業名 197.16-339.6 / 装置ID 485.04-553.8 / 作業場所 589.8-660.48 (行罫線 104.28-114.96)
 *     職長名 = 静的「氏名:」右端 359.1 〜「（安衛法60条」左端 414.36 (行罫線 116.04-126.72)
 *   入りきらない場合は minFontSize まで縮小。縦位置 (centerY, 3.8pt 補正) は v10 と同一。
 *
 * ---- v10 ----
 * - Global Meiryo vertical calibration: 3.8pt DOWN
 * - PHS values: existing 1.0pt UP correction retained
 * - 作業日 exact cell rect: [92.40,116.04,265.92,126.72]
 * - 作業日 whiteout inset: 1.2pt
 */
const EMERG_PDF_COORD_MAP = {
  meta: {
    masterFile: "Emerg_Master_Blank_v2.pdf",
    pageSizePt: [841.92, 595.32],
    coordinateOrigin: "top-left",
    version: "v12",
    workTitleRule: "strip leading OFX/OBE from machineId, then join shortMachineId + single space + troubleName; do not insert underscore",
  },
  page1: {
    repairTrouble: {
      REPAIR: [101.04, 104.4, 128.04, 114.84],
      TROUBLE: [125.18, 104.4, 148.69, 114.84],
    },
    fields: {
      workTitle: {
        x: 199.0,
        centerY: 109.74,
        fontSize: 6.2,
        align: "center",
        xRange: [197.16, 339.6],
        minFontSize: 4.5,
      },
      machineId: {
        x: 486.0,
        centerY: 109.74,
        fontSize: 6.2,
        align: "center",
        xRange: [485.04, 553.8],
        minFontSize: 4.5,
      },
      workLocation: {
        x: 592.0,
        centerY: 109.74,
        fontSize: 6.2,
        align: "center",
        xRange: [589.8, 660.48],
        minFontSize: 4.5,
      },
      workDateTime: {
        rect: [92.4, 116.04, 265.92, 126.72],
        fontSize: 5.5,
        align: "center",
        whiteout: true,
        whiteoutInsetPt: 1.2,
        yAdjustPt: 0.0,
      },
      leaderName: {
        x: 360.9,
        centerY: 121.38,
        fontSize: 5.8,
        align: "center",
        xRange: [359.1, 414.36],
        minFontSize: 4.5,
        displayRule: "static 氏名: + dynamic name",
      },
      leaderPHS: {
        x: 568.12,
        centerY: 121.38,
        fontSize: 5.3,
        align: "left",
        yAdjustPt: 0.0,
      },
      workers: [
        {
          name: {
            x: 110.52,
            centerY: 133.23,
            fontSize: 6.4,
            align: "left",
            displayRule: "static 氏名: + dynamic name",
          },
          phs: {
            x: 282.82,
            centerY: 133.14,
            fontSize: 4.8,
            align: "left",
            yAdjustPt: 0.0,
          },
        },
        {
          name: {
            x: 321.96,
            centerY: 133.23,
            fontSize: 6.4,
            align: "left",
            displayRule: "static 氏名: + dynamic name",
          },
          phs: {
            x: 500.86,
            centerY: 133.14,
            fontSize: 4.8,
            align: "left",
            yAdjustPt: 0.0,
          },
        },
        {
          name: {
            x: 538.08,
            centerY: 133.23,
            fontSize: 6.4,
            align: "left",
            displayRule: "static 氏名: + dynamic name",
          },
          phs: {
            x: 714.22,
            centerY: 133.14,
            fontSize: 4.8,
            align: "left",
            yAdjustPt: 0.0,
          },
        },
        {
          name: {
            x: 110.52,
            centerY: 144.99,
            fontSize: 6.4,
            align: "left",
            displayRule: "static 氏名: + dynamic name",
          },
          phs: {
            x: 282.82,
            centerY: 144.9,
            fontSize: 4.8,
            align: "left",
            yAdjustPt: 0.0,
          },
        },
        {
          name: {
            x: 321.96,
            centerY: 144.99,
            fontSize: 6.4,
            align: "left",
            displayRule: "static 氏名: + dynamic name",
          },
          phs: {
            x: 500.86,
            centerY: 144.9,
            fontSize: 4.8,
            align: "left",
            yAdjustPt: 0.0,
          },
        },
        {
          name: {
            x: 538.08,
            centerY: 144.99,
            fontSize: 6.4,
            align: "left",
            displayRule: "static 氏名: + dynamic name",
          },
          phs: {
            x: 714.22,
            centerY: 144.9,
            fontSize: 4.8,
            align: "left",
            yAdjustPt: 0.0,
          },
        },
      ],
    },
    qualifications: {
      "職長-安衛法60条": [411.36, 116.83, 452.09, 125.99],
      "職長-職長": [455.52, 116.26, 479.03, 126.5],
      "職長-電気": [490.47, 116.26, 513.84, 126.5],
      "職長-ガス": [523.44, 116.26, 550.37, 126.5],
      "作業者1-安衛法60条": [123.96, 128.59, 164.69, 137.75],
      "作業者1-職長": [167.64, 128.02, 191.15, 138.26],
      "作業者1-電気": [202.59, 128.02, 225.96, 138.26],
      "作業者1-ガス": [235.56, 128.02, 262.49, 138.26],
      "作業者2-安衛法60条": [338.28, 128.59, 379.01, 137.75],
      "作業者2-職長": [383.88, 128.02, 407.39, 138.26],
      "作業者2-電気": [420.27, 128.02, 443.64, 138.26],
      "作業者2-ガス": [453.58, 128.02, 480.71, 138.26],
      "作業者3-安衛法60条": [551.52, 128.59, 592.25, 137.75],
      "作業者3-職長": [595.2, 128.02, 618.71, 138.26],
      "作業者3-電気": [631.11, 128.02, 654.48, 138.26],
      "作業者3-ガス": [665.99, 128.02, 692.92, 138.26],
      "作業者4-安衛法60条": [123.96, 140.35, 164.69, 149.51],
      "作業者4-職長": [167.64, 139.78, 191.15, 150.02],
      "作業者4-電気": [202.59, 139.78, 225.96, 150.02],
      "作業者4-ガス": [235.56, 139.78, 262.49, 150.02],
      "作業者5-安衛法60条": [338.28, 140.35, 379.01, 149.51],
      "作業者5-職長": [383.88, 139.78, 407.39, 150.02],
      "作業者5-電気": [420.27, 139.78, 443.64, 150.02],
      "作業者5-ガス": [453.58, 139.78, 480.71, 150.02],
      "作業者6-安衛法60条": [551.52, 140.35, 592.25, 149.51],
      "作業者6-職長": [595.2, 139.78, 618.71, 150.02],
      "作業者6-電気": [631.11, 139.78, 654.48, 150.02],
      "作業者6-ガス": [665.99, 139.78, 692.92, 150.02],
    },
  },
  page2: {
    repairTrouble: {
      REPAIR: [101.04, 95.76, 128.04, 106.2],
      TROUBLE: [125.18, 95.76, 148.69, 106.2],
    },
    fields: {
      leaderName: {
        x: 360.9,
        centerY: 114.42,
        fontSize: 5.8,
        align: "left",
        displayRule: "static 氏名: + dynamic name",
      },
      leaderPHS: {
        x: 568.12,
        centerY: 114.42,
        fontSize: 5.3,
        align: "left",
        yAdjustPt: 0.0,
      },
    },
    qualifications: {
      "職長-安衛法60条": [411.36, 109.87, 452.09, 119.03],
      "職長-職長": [455.52, 109.3, 479.03, 119.54],
      "職長-電気": [490.47, 109.3, 513.84, 119.54],
      "職長-ガス": [523.44, 109.3, 550.37, 119.54],
    },
  },
  rules: {
    repairTroubleMode: {
      required: true,
      values: ["REPAIR", "TROUBLE"],
      default: null,
      syncTargets: ["page1.repairTrouble", "page2.repairTrouble"],
    },
    workerName: {
      horizontal: "left",
      vertical: "center",
      prefixIsStaticInMaster: true,
      fontSizePt: 6.4,
    },
    workTitle: {
      source: ["machineId", "troubleName"],
      machineIdTransform: "remove leading OFX or OBE only",
      separator: " ",
      underscoreSeparator: false,
      example: "OBEV504 + POLI1 Sensor Error -> V504 POLI1 Sensor Error",
    },
    dynamicTextVerticalAlign: {
      method: "v12: glyph ink center == centerY (PdfOverlayService v12.3). downPt is no longer used.",
      downPt: 0,
      reason: "User accepted 3.8pt as the common center baseline for normal dynamic fields.",
    },
    phsVerticalAlign: {
      fieldAdjustPt: -1.0,
      meaning: "negative = move upward",
      reason: "Leader/worker PHS values rendered lower than adjacent static PHS labels.",
    },
    workDate: {
      endTimeOutput: false,
      displayExample: "2026年9月27日  (10時00分 ～　　　　　)",
      blankAfterTilde: "5 ideographic spaces (U+3000)",
      exactCellRectPt: [92.4, 116.04, 265.92, 126.72],
      whiteoutInsetPt: 1.2,
      reason:
        "The previous work-date rect extended outside the real B7:F7 date cell (left into 作業日 label / right into 職長 label), which masked black borders. v10 uses the actual PDF border coordinates.",
    },
  },
};
