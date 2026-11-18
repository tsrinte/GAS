# 수정본 2026-11-12 (회사 GAS 미검증)

> **상태: LOCAL-SIM PASS / 회사 GAS 미실행 (VERIFIED 아님)**
> 샘플 Excel + Node 모의 런타임(`local_sim/`)에서만 통과했습니다. 회사 GAS `/dev` 에서 `runStep5WebApiTest()` 가 `RESULT = OK` 로 끝나야 VERIFIED 입니다.

## 1. 현재단계 요약

| 현재단계 | 확인결과 | 미완료 | 수정파일 | 테스트 | 승인조건 |
|---|---|---|---|---|---|
| Step5 Gate A+B `/dev` 실검증 전 | 샘플 재현으로 결함 4건 확인, 수정본 LOCAL-SIM PASS | 회사 GAS 실행, 실데이터 職長 매칭 | 아래 4개 | `runStep5WebApiTest()` | 로그 C1~C8 전부 PASS, `RESULT = OK` + `/dev` 화면 확인 |

## 2. 수정 파일 (GAS 프로젝트 안 파일명 = 이 폴더의 파일명)

각 파일은 **코드 전체 교체**입니다. GAS 편집기에서 같은 이름의 파일 내용을 전부 지우고 붙여넣으십시오.

| GAS 파일명 | 수정본 | 교체 전 (원본, `../source/CODE/CURRENT_PROPOSED/`) | 바뀐 점 |
|---|---|---|---|
| `TroubleListReader.gs` | v7 PhoneticFix | `TroubleListReader_v6_StrictPrimaryCache.gs` | sharedStrings `<rPh>`(ふりがな)를 셀 값에서 제외. 全棟一覧 header score 4 원인 해소. cache key `TL_JOBS_V7` |
| `ReferenceDataService.gs` | v6 WorkerPairFix | `ReferenceDataService_v5_AllSectionsLeaderMatch.gs` | `<rPh>` 제외, Worker 2행 1세트 판정 수정(フリガナ 행 오등록 방지), 동명이인 병합 금지(`displayLabel`), 職長 kana 좁히기, cache key `WORKER_FAST_V3` / `INFO_LEADERS_V3` |
| `Step5WebApiTest.gs` | v4 StrictChecks | `Step5WebApiTest_v3_QualificationAndPHSFix.gs` | 성공조건 C1~C8을 하나라도 어기면 `RESULT = NG` + Error |
| `Index.html` | v0.6.1 | `Index_Step5A_v0.6_TabConfirm_KY_SimpleFix.html` | 작업자 선택지에 `displayLabel` 표시(동성·동명 구분). 그 외 v0.6과 동일 |

변경 없이 그대로 쓰는 파일: `JobDataService.gs`(v3 SourceDate), `WebAppApi.gs`(v3), `WebApp.gs`, `Config.gs` / `BoxAuth.gs` / `BoxApi.gs`(회사 GAS의 기존 파일).

## 3. 필요한 Script Properties (기존과 동일, 추가 없음)

- `BOX_TROUBLE_LIST_FOLDER_ID`
- `BOX_INFO2026_FILE_ID`
- `BOX_WORKER_MASTER_FOLDER_ID`
- 그 외 `Config.gs` / `BoxAuth.gs` 가 쓰는 기존 Box 인증 Properties

## 4. 테스트 방법

1. GAS 편집기에서 위 4개 파일을 교체하고 저장
2. 함수 선택에서 `runStep5WebApiTest` 실행
3. 실행 로그 확인

### 성공조건 (하나라도 NG면 `RESULT = NG`)

| ID | 조건 |
|---|---|
| C1 | Trouble jobs > 0 |
| C2 | Worker options > 0 |
| C3 | 각 작업자의 ✓ 대상 B셀이 정확히 1개 (동명이인 병합 금지) |
| C4 | `workerKey` 중복 없음 |
| C5 | フリガナ 행이 작업자로 등록되지 않음 |
| C6 | 職長 후보가 있으면 1명 이상 Worker Master와 일치(resolved) |
| C7 | 수동 PHS override가 draft에 반영 |
| C8 | 職長 = 作業者 동시 선택 차단 (resolved 職長이 있을 때) |

WARN(성공조건 아님, 사람이 확인): unresolved 職長 목록, Info2026 装置情報 미발견, 동명이인 행 목록.

`RESULT = OK` 이면 `/dev` URL로 Web App을 열어 작업 선택 → 작업자 선택지에 동명이인이 구분되어 보이는지 확인

### 되돌리기

문제가 있으면 위 표의 "교체 전" 원본 파일 내용으로 다시 교체하면 됩니다. cache key가 바뀌었으므로 원본으로 돌아가도 수정본 캐시와 섞이지 않습니다.

## 5. 아직 확인되지 않은 것 (가설 포함)

- 샘플 Info2026의 職長 이름이 더미 값이라, 職長 매칭(C6, C8)은 **실데이터에서만** 검증 가능
- 같은 이름의 행이 실제로 같은 사람인지(동명이인 vs 중복 기재) 운영 확인 필요
- 운영 데이터의 フリガナ 반각/전각 여부
- `Config.gs` / `BoxAuth.gs` / `BoxApi.gs` 원문 미제공 → 이 파일들과의 호환은 회사 GAS 실행으로만 확인 가능

## 6. local_sim/

Node에서 GAS 서버 코드를 샘플 Excel로 돌려 본 모의 런타임입니다. 결과는 LOCAL-SIM 판정이며 `/dev` 실검증을 대신하지 않습니다. `run_v.js` 의 경로(`../zip/`, `../fixtures/`, `../tools/node_modules/`)는 작성 당시 작업 폴더 기준이라 이 저장소에서 쓰려면 `../source/` 등으로 조정해야 하고, fixture(시트명을 全棟一覧으로 바꾼 Trouble List 사본)는 포함되어 있지 않습니다.
