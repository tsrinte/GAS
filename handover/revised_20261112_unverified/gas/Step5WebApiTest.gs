/**
 * =========================================================
 * STEP 5A Web API Test v4 StrictChecks  (2026-11-12, base = v3)
 *
 * v3 문제: 職長 9명 전원 unresolved / 装置情報 미발견이어도 RESULT = OK 로 끝났다.
 * v4: 아래 성공조건을 하나라도 어기면 RESULT = NG 로 끝나고 Error를 던진다.
 *
 *  C1  Trouble jobs > 0
 *  C2  Worker options > 0
 *  C3  각 작업자의 ✓ 대상 B셀은 정확히 1개 (동명이인 병합 금지)
 *  C4  workerKey 중복 없음
 *  C5  フリガナ 행이 작업자로 등록되지 않음
 *      (어떤 작업자의 name row 가 다른 작업자의 detail row 와 같으면 NG)
 *  C6  職長 후보가 있으면 1명 이상 Worker Master 와 일치(resolved)
 *  C7  수동 PHS override 가 draft 에 반영
 *  C8  職長 = 作業者 동시 선택 차단 (resolved 職長이 있을 때)
 *
 *  WARN(성공조건 아님, 사람이 확인):
 *  - unresolved 職長 목록
 *  - Info2026 装置情報 미발견
 *  - 동명이인 행 목록
 *
 * Required (same GAS project, one file per name):
 * - TroubleListReader.gs      v7 PhoneticFix
 * - JobDataService.gs         v3 SourceDate
 * - ReferenceDataService.gs   v6 WorkerPairFix
 * - WebAppApi.gs              v3 TabValidationAndPHSOverride
 * - Config.gs / BoxAuth.gs / BoxApi.gs (existing, unchanged)
 * =========================================================
 */

function runStep5WebApiTest() {
  const ng = [];

  const warn = [];

  function check_(id, ok, message) {
    console.log("[" + id + "] " + (ok ? "PASS" : "NG") + " : " + message);

    if (!ok) {
      ng.push(id + " " + message);
    }
  }

  console.log("==============================");

  console.log("[STEP 5A WEB API TEST v4] START");

  console.log("==============================");

  const bootstrap = apiBootstrap();

  check_("C1", bootstrap.jobs.length > 0, "Trouble jobs=" + bootstrap.jobs.length + " / source=" + bootstrap.source.fileName);

  if (!bootstrap.jobs.length) {
    throw new Error("RESULT = NG : " + ng.join(" | "));
  }

  const sample =
    bootstrap.jobs.find(function (job) {
      return String(job.no) === "1837" && String(job.machineId) === "OBEV504";
    }) || bootstrap.jobs[0];

  console.log("[SAMPLE JOB] No." + sample.no + " / " + sample.machineId + " / " + sample.environment);

  const loaded = apiLoadJob(sample.jobKey);

  const workers = loaded.workerOptions || [];

  const leaders = loaded.leaderOptions || [];

  console.log("[WORK DATE] " + loaded.jobData.workDate + " / source=" + loaded.jobData.sourceTroubleFileName);

  check_("C2", workers.length > 0, "workers=" + workers.length);

  const multiCell = workers.filter(function (worker) {
    return (worker.attendanceCells || []).length !== 1;
  });

  check_(
    "C3",
    multiCell.length === 0,
    "attendanceCells != 1 : " +
      multiCell.length +
      (multiCell.length
        ? " " +
          JSON.stringify(
            multiCell.slice(0, 5).map(function (worker) {
              return worker.fullName + " " + (worker.attendanceCells || []).join(",");
            }),
          )
        : ""),
  );

  const keySeen = {};

  const dupKeys = [];

  workers.forEach(function (worker) {
    if (keySeen[worker.workerKey]) {
      dupKeys.push(worker.workerKey);
    }

    keySeen[worker.workerKey] = true;
  });

  check_("C4", dupKeys.length === 0, "duplicate workerKey=" + dupKeys.length);

  const detailRows = {};

  workers.forEach(function (worker) {
    detailRows[worker.sourceQualificationRow] = worker.fullName;
  });

  const furiganaAsWorker = workers.filter(function (worker) {
    return detailRows[worker.sourceNameRow] !== undefined;
  });

  check_(
    "C5",
    furiganaAsWorker.length === 0,
    "furigana rows registered as worker=" +
      furiganaAsWorker.length +
      (furiganaAsWorker.length
        ? " " +
          JSON.stringify(
            furiganaAsWorker.slice(0, 5).map(function (worker) {
              return worker.fullName + "@" + worker.sourceNameRow;
            }),
          )
        : ""),
  );

  const unresolved = leaders.filter(function (leader) {
    return !leader.qualificationResolved;
  });

  check_("C6", leaders.length === 0 || unresolved.length < leaders.length, "leaders=" + leaders.length + " / resolved=" + (leaders.length - unresolved.length) + " / unresolved=" + unresolved.length);

  if (unresolved.length) {
    warn.push("unresolved 職長=" + unresolved.length);

    console.log(
      "[WARN UNRESOLVED LEADERS] " +
        JSON.stringify(
          unresolved.map(function (leader) {
            return { name: leader.name, raw: leader.nameRaw, kana: leader.kana || "", matchCount: leader.qualificationMatchCount };
          }),
        ),
    );
  }

  if (!loaded.reference.info2026.deviceFound) {
    warn.push("Info2026 装置情報 not found: " + sample.machineId);

    console.log("[WARN] Info2026 装置情報 not found: " + sample.machineId);
  }

  const duplicates = workers.filter(function (worker) {
    return worker.duplicateFullName;
  });

  if (duplicates.length) {
    warn.push("duplicate full-name rows=" + duplicates.length);

    console.log(
      "[WARN DUPLICATE NAMES] " +
        JSON.stringify(
          duplicates.slice(0, 10).map(function (worker) {
            return worker.displayLabel;
          }),
        ),
    );
  }

  const leader =
    leaders.find(function (item) {
      return item.qualificationResolved;
    }) || leaders[0];

  if (leader) {
    const manualPhs = "99999";

    const selectedWorkers = workers
      .filter(function (worker) {
        return !leader.workerKey || worker.workerKey !== leader.workerKey;
      })
      .filter(function (worker) {
        return leader.workerKey || worker.name !== leader.name;
      })
      .slice(0, 2)
      .map(function (worker) {
        return worker.workerKey;
      });

    const draft = apiPrepareJobDraft({
      jobKey: sample.jobKey,
      workDate: loaded.jobData.workDate,
      startTime: "10:00",
      repairTroubleMode: "REPAIR",
      leaderKey: leader.leaderKey,
      leaderPHS: manualPhs,
      workerKeys: selectedWorkers,
      workType: "修理",
    });

    check_("C7", draft.draft.leaderPHS === manualPhs, "manual PHS override actual=" + draft.draft.leaderPHS);

    console.log(
      "[DRAFT] " +
        JSON.stringify({
          leader: draft.draft.leader,
          leaderQualifications: draft.draft.leaderQualifications,
          workers: draft.draft.workers.map(function (worker) {
            return worker.name + " " + worker.attendanceCell;
          }),
        }),
    );

    if (leader.workerKey) {
      let blocked = false;

      try {
        apiPrepareJobDraft({
          jobKey: sample.jobKey,
          workDate: loaded.jobData.workDate,
          startTime: "10:00",
          repairTroubleMode: "REPAIR",
          leaderKey: leader.leaderKey,
          leaderPHS: manualPhs,
          workerKeys: [leader.workerKey],
        });
      } catch (error) {
        blocked = String(error.message || error).indexOf("職長と同じ人物") !== -1;
      }

      check_("C8", blocked, "leader=worker guard");
    } else {
      console.log("[C8] SKIP : no resolved leader");
    }
  }

  console.log("==============================");

  console.log("[WARNINGS] " + (warn.length ? warn.join(" | ") : "none"));

  if (ng.length) {
    console.log("[STEP 5A WEB API TEST v4] RESULT = NG");

    console.log("==============================");

    throw new Error("RESULT = NG : " + ng.join(" | "));
  }

  console.log("[STEP 5A WEB API TEST v4] RESULT = OK");

  console.log("==============================");

  return { ok: true, warnings: warn };
}
