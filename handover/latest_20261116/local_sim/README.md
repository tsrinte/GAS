# Local GAS simulation (LOCAL-SIM)
Node에서 GAS 서버 코드(TroubleListReader/JobData/Reference/WebAppApi/Step5Test)를 샘플 Excel로 실행하는 모의 런타임.
- 결과는 LOCAL-SIM 판정이며 회사 GAS /dev 실검증(VERIFIED)을 대신하지 않음.
- 의존: npm i @xmldom/xmldom@0.8.10 adm-zip@0.5.16 (gasmock.js 상단 경로 T 수정)
- 샘플 Trouble List는 시트명이 Sheet1이라, 시트명을 全棟一覧으로 바꾼 사본(fixture)을 사용했음.
- 실행: node run_v.js old|new [dump]
