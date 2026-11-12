# GAS + Box 프로젝트 인수인계 소스 (2026-11-12)

이 압축파일은 PDF 인수인계 보고서와 함께 Gemini에서 개발을 이어갈 수 있도록 구성한 소스 증빙 모음입니다.

## 먼저 확인
1. 최우선: `DOCUMENTATION/CURRENT_STATUS.md`
2. 최신 설계: `SOURCE_DATA/Checklist_Automation_Operational_Mapping_v5.0.xlsx`
3. `CODE/CURRENT_PROPOSED/` 는 **마지막으로 작성된 코드**입니다. 전체 코드의 실제 실행 검증이 완료된 상태가 아닙니다.
4. `CODE/HISTORY/`는 구현 이력입니다. 절대 모든 파일을 같은 GAS 프로젝트에 붙여넣지 마십시오. 같은 함수/상수 중복이 발생합니다.
5. `CODE/CURRENT_PROPOSED/` 안의 실제 배치 파일명은 `CODE/current_code_manifest.json`에 기록됩니다.
6. `Config.gs`, `BoxAuth.gs`, `BoxApi.gs` 원본은 이 컨테이너에서 확인되지 않아 포함되지 않았습니다. 회사 GAS 프로젝트에서 별도 추출이 필요합니다.
7. `PdfRuntimeLoader_SmokeTest_v8...gs`는 SmokeTest를 포함하므로, 실제 배치 중인 `PdfRuntimeLoader.gs`와 동일한지 반드시 확인하십시오.
8. 제공된 Source xlsx는 개발 샘플이며 Box에서 실제 사용한 최신 `EFTトラブル管理リストRev5.10_20260928.xlsm` 원본은 확인되지 않습니다.

## 보안
사내 정보(작업자명/연락처/고객 장치정보/안전명부)가 포함될 수 있습니다. 조직이 허가한 Google Workspace Enterprise Gemini 환경에서만 업로드하고, 외부 개인계정으로 전송하지 마십시오. 인증 토큰, Client Secret, OAuth Refresh Token 및 폰트 바이너리는 포함하지 않았습니다.

## 자료 범위
대화 원문 100% verbatim export가 아닙니다. 현재 접근 가능한 대화/프로젝트 이력과 실제 파일을 바탕으로 구성한 기술 기록입니다. 원문 전체가 필요하면 사용자가 ChatGPT 자체 데이터 내보내기 기능으로 별도 확보해야 합니다.
