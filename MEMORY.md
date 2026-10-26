# MEMORY — GAS 사무자동화 (CMP Job 로그 자동 취합·분석)

프로젝트의 핵심 결정 사항과 데이터 구조 메모. 대화에서 확정될 때마다 갱신한다.

## 목표
BOX에 매일 올라오는 CMP 장치 Job 로그(CSV)를 GAS로 자동 취합하고, 분석 Web App과 Original Sequence(xlsx) 삽입 기능을 제공한다.
개발 목표: ① 트리거로 BOX 자동 갱신 ② 취합 파일 출력 + Original Sequence 삽입 ③ 날짜별 SET/Max/Min/Act 추이 대시보드.

## 확정 결정 (2026-10-26)
- BOX 연동: OAuth2 (기존에 다른 자동화 사용 실적 있음).
- 원본 BOX 파일은 절대 수정하지 않는다. 신규 파일(예: 날짜 폴더 안 `Process_Total`)을 만들어 BOX에 저장한다.
- 실행 로그·에러 로그 저장 위치는 사용자가 추후 알려줌.
- 구글(GAS) 반출 허용 (중요 데이터는 삭제된 상태).
- 코드·MEMORY.md는 저장소 `tsrinte/GAS`에 바로 반영한다.
- 1차 분석: 10/07 이후, 테이블(A,B,C,D)별 처리 웨이퍼 매수 + 슬러리 사용 유무 + Pad 온도 + 드레서 토크를 한 화면에서. 최종적으로는 모든 Caption 항목 누적.

## BOX 폴더 구조
Main/Project/Log(이름 가변)/Start Log/일별로그/날짜폴더(1010 등)/
- `CJ_..._(링크번호)` 폴더 안에 웨이퍼별 상세 CSV `ProcessLog_<Carrier>.<Slot>_<C#W##>_<SystemWaferID>.csv`
- `ProcessLog_Job.csv`, `ProcessLog_Summary.csv` (날짜폴더 공통)

## 샘플 CSV 분석
- 모두 UTF-8 BOM, 헤더는 일본어/영어 혼재(반각 카타카나 포함). 장치 일본어 Caption은 그대로 키로 쓰고 한글/영문 표시명 매핑을 둔다.
- **Job.csv**: SystemLotID, Carrier, LotID, CJID, TotalRecipe, SystemWaferList(`;` 구분), Port, Wafers, State, StartingTime, EndingTime, Elapsed.
- **Summary.csv**: 웨이퍼 1행. SystemWaferID, 取出位置(C#W##), プロセスルート(`1 Table A~D`), 폴리셔 처리시간 Act/Set, 클리너, PRE/POST METRO 막두께, SystemLotID. 컬럼은 레시피에 따라 가변.
- **상세 CSV**: 한 파일에 여러 섹션이 빈 줄로 구분됨. 섹션명이 1열(WaferInfo, Polisher?_G3_Step, ..._Common, Cleaner*_Step, POST_METRO_*, SubstHistory, ProcessResult, APCResult).
  - `Polisher?_G3_Step`: 행 = (Set/Act/Max/Min × Caption), 열 = Step1~Step20. Step 수와 열 위치는 레시피마다 달라질 수 있음. 폴리셔 문자(A~D)가 섹션명에 들어감.
  - Pad 온도 Caption = `Pad温度`(Set 없음, Max/Min/Act). 슬러리 관련은 `ｽﾗﾘ-ﾗｲﾝA 圧力` 등, 드레서는 `D.R. 押付荷重`, `D.R. 回転数` 등.
  - 섹션 안에서 열 위치(C/D열)가 처리 방법에 따라 바뀌므로 위치가 아닌 헤더/Caption 기준으로 파싱한다.
- 링크 키: SystemLotID(Job↔Summary), SystemWaferID(Summary↔상세 파일명).

## Original Sequence (xlsx)
사람이 수동 입력하는 시트. 열: Date, Event, Carrier, Slot, Film, Wfs, D/M, TotalRecipe, Route, ME Recipe, Remark, Side, P/T, TT Rot, TR Rot, DR Rot/Load, A1P~A8P, RRP, Slurry, Ex-situ Dress 등. 파란 셀 부분을 로그에서 채워 행 사이사이에 insert하는 것이 목표.

## 단계(Step) 진행 상황
- Step1: 요구사항·데이터 구조 파악 (진행 중, 샘플 확인 완료)
