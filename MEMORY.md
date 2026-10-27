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

## 추가 결정 (2026-10-26, 2차 답변)
- **표시명은 일본어 Caption 그대로** 사용 (한글 매핑 안 함). UI 라벨도 장치 Caption 기준.
- **Sequence 시트 기준점 = Step5의 Set 값** (P/T=`処理時間` Set Step5, TT=`T.T. 回転数` Set Step5 등). 기준 Step은 드롭다운으로 변경 가능.
- **Wfs(웨이퍼 수)** = Job.csv의 `Wafers` 열. 검증용으로 Summary의 SystemLotID ↔ SystemWaferID 건수를 대조.
- **슬러리 사용 판정/유량 적산**: `ﾗｲﾝ A 選択` / `ﾗｲﾝ D 選択`의 Set이 `供給`인 Step에 대해, 해당 라인 `ﾗｲﾝA 供給流量` / `ﾗｲﾝD 供給流量`의 Act(mL/min) × `処理時間` Act(s)/60을 합산 → 총 유량(mL). 기본 Step1~5, 유저가 Step 범위를 드롭다운으로 선택(예: Step1~6, 2~7).
- **대시보드**: 고정 항목 외에 모든 Caption을 드롭다운/태그로 골라 날짜별 누적·추이를 볼 수 있게 한다. 기본 표시는 테이블(A~D)별 매수·슬러리·Pad温度·드레서 값, 10/07 이후.
- 테이블 A~D는 레시피 형식이 동일 (섹션명의 `PolisherD`처럼 폴리셔 문자만 다름).
- BOX Client ID/Secret은 새로 발급 (기존 자동화와 분리). 시크릿은 스크립트 속성에만 저장, 대화·저장소에 넣지 않는다.
- 규모: 하루 상세 CSV 약 30~400개 → 증분 처리 + 6분 실행 제한 대응(배치/이어서 실행) 필요.

## 추가 결정 (2026-10-27, 3차 답변)
- Act 값이 0이면 0 그대로, 비어 있으면 0으로 처리 (보정·대체 없음, 시트와의 정합성 우선).
- **Set 대비 Act가 ±10% 이상 벗어나면 UI에서 눈에 띄게 강조** (전 레시피 대상).
- 드레서는 토크 Caption이 없으므로 `D.R. 押付荷重` Act, `D.R. 押付荷重(ロードセル)` Act를 사용. Caption을 드롭다운으로 바꿔 볼 수 있게 한다. (단위는 E열)
- **소모품 카운터**(PolisherD_G3_Common의 Caption/E 단위/F 값)를 날짜별 적산, 화면 오른쪽에 실시간 표시: Retainer Ring / Membrane / Dresser / Table(Polishing) / Table(Dress) / Retainer Ring Air Bag 각 Processed Wafer·Time (10개).
- 코딩 시작 조건: 사용자와 화면 시안·의도 합의 후. 화면 시안은 Artifact로 공유 (샘플 값).

## 추가 결정 (2026-10-27, 4차 피드백 → 웹앱 2차)
- **아키텍처**: 화면은 단일 HTML(`webapp/CMP_LogAnalyzer.html`)로 만들고 브라우저 안에서 CSV·xlsx를 처리한다. `python3 webapp/build.py` → `webapp/dist/CMP_LogAnalyzer_offline.html`(ExcelJS 내장, 인터넷 없이 PC에서 열어서 사용). BOX 자동 취합(GAS 트리거)은 같은 화면에 데이터 소스로 붙인다 (Step2).
- 슬러리: 레시피 총 Step 자동 파악(処理時間 Set/Act > 0인 마지막 Step). ﾗｲﾝ○ 選択 = 供給인 Step만 Σ(流量 Act × 時間 Act / 60). 라인 기호는 Caption에서 추출(일본어 ﾗｲﾝ/ライン, 영어 Line). 카드 표기 `スラリ総流量(A)`, `(D)`. 사용 매수는 A·D 동시 공급도 1매.
- Step 드롭다운: 기본 Step1~Step5, 왼쪽은 전반(1~총Step/2), 오른쪽은 왼쪽 값 이후 전부(전반/후반 그룹 표시). ※사용자 원안(오른쪽=후반만)은 기본값 Step5와 충돌 → 확인 요청함.
- DMY 판정: ﾗｲﾝ 選択이 모두 無効, 또는 로트/레시피에 DMY 포함.
- Pad初期－現在Pad厚み差分 = ﾊﾟｯﾄﾞｻｰﾁ時ﾊﾟｯﾄﾞ.高さ Act − Pad厚みセンサー Act (기간 내 최신 웨이퍼, AVE 병기).
- 카드·소모품 카운터·그래프: 테이블 간 평균 대비 ±10% 이상이면 강조(▲, 빨간 원).
- 소모품 카운터: PolisherA~D 열로 나란히, 対象日 2개(기본 = 최신 데이터 날짜), 현재값 + 기간 증분, 아래 막대 그래프.
- Sequence 挿入: PC 파일 열기/드롭, 시트 `シーケンス表` 기본, 행 선택 후 위/아래 삽입, 체크한 행만, 드래그&드롭, 원본은 건드리지 않고 별명 저장. 기준 Step 기본 Step5 Set, Ex-situ Dress 열은 D.R. 押付荷重 Set>0 인 Step.
- 저장: Process_Total(Wafers+Raw 시트), 10MB 초과 시 `_1`, `_2`… 분할. 다시 드롭하면 이어서 집계.
- 乖離표: 処理時間 Set 999.9(EP 상한 시간)는 기본 제외(체크박스).

## 추가 결정 (2026-10-27, 5차 피드백 → 웹앱 3차)
- 방향 확정: BOX 자동 취합(GAS 트리거)이 기본, 인터넷이 없는 환경은 「ProcessLog取込」(PC 폴더)로 대응. 하나의 툴로 유지.
- 탭 이름: Dashboard / Sequence 挿入 / ProcessLog取込. 헤더에 Light/Dark 전환(선택은 브라우저에 기억).
- 集計 Step 範囲: 왼쪽·오른쪽 모두 Step1~20, 기본 Step1~Step5. 슬러리·추가 항목·日次推移에 적용. Pad温度 = 범위 끝 Step(기본 Step5)의 Act, 전 웨이퍼 평균.
- 추가 항목 범위 밖(예: D.R. 은 Step10)은 「範囲外(Step10)」로 표시.
- 테이블 카드: 개별 Excel 버튼 삭제, 카드 전체 스크린샷(PNG) 저장 버튼. 日次推移: 스크린샷 + Excel, 단위 표시, 높이 수동(px). テーブル別比較: 스크린샷.
- 乖離: 처리시간 Set 999.9(EP 상한)은 항상 제외(체크박스 없음). 기준 0~20%(기본 10%). 발생 시각·슬롯(s01) 표시. 날짜×시간대 히트맵(테이블 선택, 클릭하면 표 필터).
- Sequence 挿入: 원본 시트는 테마와 무관하게 흰 바탕+원본 셀 색. 서식만 있는 하단 빈 행은 표시하지 않고 가상 스크롤로 경량화. 후보는 별도 기간 지정, 슬롯은 01-04로 압축, 삽입 행은 노란색+NEW, 삽입 내역 목록. Ex-situ Dress Step 표시는 삭제(내부 자동 검출은 유지). .xlsm 은 저장 시 매크로가 빠짐(안내 표시).
- ProcessLog取込: 큰 점선 드롭 영역+폴더 아이콘(클릭으로 폴더 선택), BOX 는 「※BOX接続検討中」.

## 추가 결정 (2026-10-27, 6차 피드백 → 웹앱 4차)
- D.R. 로 시작하는 항목(D.R. 押付荷重 등)은 集計 Step 範囲 대신 Dress Step(D.R. 押付荷重 Set > 0 인 Step, 예: Step10) 값을 자동 사용. 카드·日次推移에 「Dress Step」 표시. 「範囲外」 안내는 D.R. 이외 항목만.
- Sequence 저장: 원본 .xlsx 를 그대로 열어(JSZip) 시퀀스 시트 XML 에만 행을 삽입하고 별명 저장. 다른 시트·스타일·공유 문자열은 원본 그대로(바이트 동일). 시트 안의 수식·병합·조건부 서식·데이터 유효성·코멘트·이름 정의 범위는 Excel 과 같이 행 이동. 다른 시트에서 시퀀스 시트를 참조하는 수식만 참조 행을 맞춰 갱신(그 외는 손대지 않음). 열 때 Excel 이 재계산(calcChain 제거). 실패 시에만 ExcelJS 로 저장. .xlsm 은 .xlsm 그대로(매크로 유지).
- 項目別日次推移: 항목 1~5(각 항목이 한 장의 그래프, x축 공유·y축 개별). 「対象日」 풀다운으로 날짜를 고르면 그 날의 웨이퍼를 시각 순으로, 풀다운 2개로 범위(예: s01~s25) 지정. Step 은 ProcessLog 의 Step1~N 중 하나(기본 Step5)로 고정하거나 「全 Step」으로 Step1~N 변화 보기.
- 에어백 세트: 항목 풀다운의 「エアバッグ圧力セット」 = ｴﾘｱ1~8 ｴｱﾊﾞｯｸﾞ圧力 + ﾘﾃｰﾅﾘﾝｸﾞ面圧. Table A~D 별 작은 그래프 4개(세로축 공통), 테이블 색의 연한색(안쪽 에리어)→진한색, RRP 는 파선. 날짜 지정 시 Job/슬롯 단위, 전체 기간은 범위 끝 Step 의 일평균.
- 乖離 히트맵: 「テーブル別(4段)」 모드(날짜마다 A/B/C/D 4단, 셀에 테이블 문자, 테이블 색). 새 날짜가 위. 시간 축은 고정, 표시 높이(コンパクト/標準/すべて) 선택 + 스크롤. 셀 클릭 필터 유지.
- ProcessLog取込: 3개 카드 같은 폭, 드롭 영역 축소. 「取込データをリセット」(2번 눌러 확정)으로 빈 상태에서 시작 가능. 「サンプルに戻す」는 결과 표 옆으로 이동.

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
- ✓ 웹앱 2차 (2026-10-27): 파서·대시보드·카운터·Sequence 삽입·로컬 폴더 취합·Process_Total 저장. 시안 https://claude.ai/artifact/KatHni399EvYhgTgfas7Yr
- ✓ 웹앱 3차 (2026-10-27): 위 5차 피드백 반영
- ✓ 웹앱 4차 (2026-10-27): 위 6차 피드백 반영(원본 보존 저장, 항목 1~5·날짜 상세·에어백 세트, 4단 히트맵, 리셋)
- 다음: 사용자 피드백 → Step2 BOX OAuth2 연동(GAS) → 트리거 자동 취합
