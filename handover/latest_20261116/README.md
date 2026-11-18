# 최신 소스 2026-11-16

이 폴더는 2026-11-16 시점의 **최신 GAS 소스 전체**입니다. GAS 프로젝트 안의 파일명과 `gas/` 폴더의 파일명이 같습니다. 각 파일은 **코드 전체 교체**로 적용합니다.

> 판정 기준: **VERIFIED** = 회사 GAS 실행 결과 OK 또는 사용자 확인. **LOCAL-SIM** = 샘플 Excel + Node 모의 런타임에서만 통과 (VERIFIED 아님).

## 1. 현재단계 요약

| 현재단계 | 확인결과 | 미완료 | 수정파일 | 테스트 | 승인조건 |
|---|---|---|---|---|---|
| Gate D 진행 중 (4종 서류 출력) | Step5 서버 VERIFIED, 突発作業 PDF VERIFIED | 作業者名簿台帳 회사 GAS 실행, 새 화면 /dev 확인, KY·簡易レポート 출력 미구현 | 아래 표 | `runStep5WebApiTest` → `runEmergPreviewTest` → `runWorkerLedgerPreviewTest` → /dev | 각 테스트 `RESULT = OK` + /dev에서 「まとめて作成」 결과 링크 확인 |

## 2. 파일별 상태

| GAS 파일명 | 버전 | 상태 | 비고 |
|---|---|---|---|
| `TroubleListReader.gs` | v7 PhoneticFix | **VERIFIED** (2026-11-15, header score 12) | `<rPh>` 제외 |
| `JobDataService.gs` | v3 SourceDate | **VERIFIED** (WORK DATE = 파일 날짜) | 인수 자료 그대로 |
| `ReferenceDataService.gs` | v6.4 NoHiddenRowLookup | **VERIFIED** (2026-11-16, Step5 v4.2 RESULT=OK) | 異体字 통일, 동성 職長 분리(樋口智/樋口遼), 숨김행은 자격조회에 쓰지 않음(사용자 결정) |
| `Step5WebApiTest.gs` | v4.2 StrictChecks | **VERIFIED** (RESULT=OK) | C1~C8, `[LEADER OPTIONS]` 출력 |
| `EmergPreviewApi.gs` | v1 (신규) | **VERIFIED** (사용자가 Box PDF 확인) | 突発作業 PDF → `BOX_TEST_FOLDER_ID` |
| `PdfOverlayService.gs` | v12.3 InkVerticalCenter | **VERIFIED** (사용자 확인) | 글자 실제 중앙 = 셀 중앙, 가로 중앙 정렬 |
| `PdfOverlayCoordinateMap.gs` | v12 | **VERIFIED** (사용자 확인) | 기존 `PdfOverlayCoordinateMap_v10.gs`는 **삭제** (const 중복) |
| `WorkerLedgerService.gs` | v1 (신규) | LOCAL-SIM PASS, 회사 GAS 미실행 | 作業者名簿台帳 복사본에 C3/H3/Z2/B열✓ → xlsx 저장 |
| `Index.html` | v0.7.0 | LOCAL-SIM PASS (브라우저 mock), /dev 미확인 | 화면 전면 재설계. 서버 API는 v0.6.6과 동일 |

변경 없이 그대로 쓰는 파일: `WebAppApi.gs`(v3), `WebApp.gs`, `BoxUploadOrVersion.gs`, `PdfRuntimeLoader.gs`, `Config.gs` / `BoxAuth.gs` / `BoxApi.gs` (회사 GAS의 기존 파일).

## 3. Script Properties (추가 없음)

- `BOX_TROUBLE_LIST_FOLDER_ID`, `BOX_INFO2026_FILE_ID`, `BOX_WORKER_MASTER_FOLDER_ID`
- `BOX_TEST_FOLDER_ID`, `BOX_EMERG_MASTER_PDF_FILE_ID`, `BOX_PDF_FONT_MEIRYO_FILE_ID`
- 그 외 `Config.gs` / `BoxAuth.gs` 가 쓰는 기존 Box 인증 Properties

## 4. 테스트 함수와 성공조건

| 함수 | 파일 | 성공조건 |
|---|---|---|
| `runStep5WebApiTest` | Step5WebApiTest.gs | C1~C8 전부 PASS, `RESULT = OK` |
| `runEmergPreviewTest` | EmergPreviewApi.gs | P2 파일명 `Emerg_*.pdf`, P3 2회째 같은 fileId(NEW_VERSION), P4 Box PDF 목시 |
| `runWorkerLedgerPreviewTest` | WorkerLedgerService.gs | W2 파일명 `Worker_*.xlsx`, W3 `[WRITTEN]`에 C3/H3/Z2/B열✓, W4 2회째 같은 fileId, W5 Excel에서 복구 메시지 없이 열림, W6 원본 Worker Master 변경 없음 |
| `runWorkerNameDiagnostic` | ReferenceDataService.gs | 진단용 (`WORKER_DIAG_NAME_` 변경 후 실행) |

## 5. 화면 (Index.html v0.7.0)

- 한 페이지에서 ① 作業を選ぶ → ② 共通の情報 → ③ 職長・作業者 → ④ 書類ごとの入力 순서로 입력
- 오른쪽 「書類を作成」 패널: 4종 서류별 준비 상태, 부족 항목 클릭 시 해당 입력란으로 이동, 「まとめて作成」
- KY / 簡易レポート는 입력란만 있고 출력은 「準備中」

## 6. 미결 사항

- 作業者名簿台帳: 職長 본인 행에도 ✓를 넣을지, 최종 결과물이 Excel인지 PDF인지 (사용자 확인 대기)
- KYシート / 簡易レポート 출력 코드 (다음 작업)
- 方田: Worker Master 숨김행에만 있어 「資格未照合」 (사용자 결정대로)
- 서버 경고문 일부가 한국어 (예: `Info2026 装置情報에서…`) → 일본어로 통일 필요

## 7. local_sim/

샘플 Excel + Node GAS 모의 런타임 스크립트와 렌더링 결과 이미지입니다. 회사 GAS 검증을 대신하지 않습니다.

- `gasmock.js`: GAS 모의 런타임 (Utilities / Cache / Properties / Lock / UrlFetch 일부)
- `run_v.js`, `run_emerg.js`, `run_worker.js`: Step5 / 突発作業 PDF / 作業者名簿台帳 로컬 실행
- `ui_test.js`: Playwright로 Index.html을 mock 서버와 함께 조작
- `*.png`: 로컬 렌더링 결과 (대체 폰트 IPA Gothic)

이전 수정본 기록: `../revised_20261112_unverified/` (2026-11-12 시점, 참고용)
