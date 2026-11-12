# 작업 전 4종 서류 자동화 (GAS + Box API + HTML Web App)

Google Workspace Enterprise 환경에서 GAS + Box API + HTML Web App으로 작업 전 4종 서류(作業者名簿台帳 / Emerg / KY / 簡易レポート)를 자동화하는 프로젝트의 인수인계 자료입니다. 2026-11-12에 ChatGPT 개발분을 인수했습니다.

> **주의:** `handover/source/CODE/CURRENT_PROPOSED/` 는 마지막으로 작성된 코드이며, 전체 실행 검증이 끝난 상태가 아닙니다. 실행검증된 기능과 코드만 작성된 기능을 구분해서 보십시오. 현재 상태는 `handover/source/DOCUMENTATION/CURRENT_STATUS.md` 가 기준입니다.

## 폴더 구성

| 경로 | 내용 |
|---|---|
| `handover/originals/` | 인수인계 원본 파일 5개 (아래 표) |
| `handover/source/` | 위 zip을 풀어 둔 내용. 저장소에서 바로 열람용 |
| `handover/source/DOCUMENTATION/` | `README_FIRST.md`, `CURRENT_STATUS.md`, `FILE_MANIFEST.json`, mapping export |
| `handover/source/CODE/CURRENT_PROPOSED/` | 최신 제안 코드 (.gs / .html). 배치 파일명은 `CODE/current_code_manifest.json` |
| `handover/source/CODE/HISTORY/` | 구현 이력. 같은 GAS 프로젝트에 모두 붙여넣지 말 것 (함수/상수 중복) |
| `handover/source/SOURCE_DATA/` | 개발용 원본 Excel/PDF 샘플, Mapping 이력 v0.1~v4.9 |
| `handover/source/EVIDENCE/` | 테스트 증빙 PDF, 스크린샷 |

### 원본 파일

| 파일 | 설명 |
|---|---|
| `사무자동화_전체개발이력_Gemini인수인계_20261112.pdf` | 개발 기록/설계/테스트/위험/백로그 |
| `Gemini_GAS_전체소스코드_20261112.pdf` | GAS 전체 소스코드 PDF |
| `GAS_Box_사무자동화_전체소스_20261112.zip` | 전체 소스 압축 원본 (`handover/source/` 와 동일 내용) |
| `Checklist_Automation_Operational_Mapping_v5.0.xlsx` | **Source of Truth** (zip 안 `SOURCE_DATA/` 의 파일과 동일) |
| `GEMINI_START_PROMPT_20261112.txt` | 이전 환경용 시작 프롬프트 |

### 포함되지 않은 것

- `Config.gs`, `BoxAuth.gs`, `BoxApi.gs` 원본 (회사 GAS 프로젝트에서 별도 추출 필요)
- 인증 토큰, Client Secret, OAuth Refresh Token, 폰트 바이너리
- Box에서 실제 사용한 최신 `EFTトラブル管理リストRev5.10_20260928.xlsm` 원본

---

## 프로젝트 인수인계 프롬프트

당신은 Google Workspace Enterprise 환경에서 GAS + Box API + HTML Web App으로 '작업 전 4종 서류 자동화'를 개발하는 엔지니어 역할이다.

다음 파일을 먼저 읽는다:

1. 사무자동화_개발인수인계_20261112.pdf (기록/설계/테스트/위험/백로그)
2. Checklist_Automation_Operational_Mapping_v5.0.xlsx (Source of Truth)
3. CURRENT_STATUS.md 와 current_code_manifest.json
4. 필요할 때만 해당 .gs/.html 원문 파일.

우선 요구:

- 실행검증된 기능과 아직 코드만 작성된 기능을 절대 혼동하지 마라.
- 기존 GAS Code의 수정은 코드 전체 교체 파일로 제공하고, 현재 파일명/필요 Properties/테스트함수/성공조건을 명시하라.
- 사내 정보는 조직 승인 범위 밖으로 보내지 마라.
- 원본 Excel/Worker Master는 읽기 전용; 출력은 Copy에만 적용.
- Step5 Gate A+B의 /dev 실검증 후, Gate C(최신 10개 날짜 source picker + 환경 필터), Gate D(4종 생성/Preview)를 단계별로 진행하라.
- 오류 분석 시 로그와 실제 파일에서 확인된 원인만 확정, 불확실하면 가설로 표시.
- 근거 불명확한 PDF 좌표나 Excel 서식 규칙을 만들지 마라.
- 답변은 한국어, GAS/UI 메뉴와 변수명은 일본어/영어 원문 보존.

반드시 UI / UX 를 생각하면서 코딩 및 html을 작성해줘 누구라도 직관적으로 바로 사용 할 수 있도록 반드시

새 작업을 시작할 때 사용자에게 일관된 표를 제시하라: 현재단계/확인결과/미완료/수정파일/테스트/승인조건.

그리고 챗 지피티로 만든 코딩이지만 이대로 메뉴얼과 방향성 대로 개발 하지말고 클로드에서 획기적인 기술이 있다면 반드시 전체적으로 검토해서 개선해서 개발해줘
