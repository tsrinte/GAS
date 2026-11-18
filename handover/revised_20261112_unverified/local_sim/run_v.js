const path=require('path');const {makeContext}=require('./gasmock');
const SRC=path.join(__dirname,'../zip/SOURCE_DATA/'), OLD=path.join(__dirname,'../zip/CODE/CURRENT_PROPOSED/'), NEW='/mnt/project-files/handover_review/gas/';
const mode=process.argv[2]; // old | new
const g=makeContext({props:{BOX_TROUBLE_LIST_FOLDER_ID:'F_TL',BOX_INFO2026_FILE_ID:'INFO',BOX_WORKER_MASTER_FOLDER_ID:'F_WK'},
 files:{TL1:{path:path.join(__dirname,'../fixtures/TL_zentou.xlsx'),name:'EFTトラブル管理リストRev1.1_20260928.xlsx',modified_at:'2026-09-28T07:00:00+09:00'},
        INFO:{path:SRC+'Info2026_r1.xlsx',name:'Info2026_r1.xlsx',modified_at:'2026-09-01T00:00:00+09:00'},
        WK:{path:SRC+'中日本装置課 安全管理体制図rev.159.xlsx',name:'中日本装置課 安全管理体制図rev.159.xlsx',modified_at:'2026-09-20T00:00:00+09:00'}},
 folders:{F_TL:['TL1'],F_WK:['WK']}});
const files = mode==='new'
 ? [NEW+'TroubleListReader.gs',OLD+'JobDataService_v3_SourceDate.gs',NEW+'ReferenceDataService.gs',OLD+'WebAppApi_v3_TabValidationAndPHSOverride.gs',NEW+'Step5WebApiTest.gs']
 : [OLD+'TroubleListReader_v6_StrictPrimaryCache.gs',OLD+'JobDataService_v3_SourceDate.gs',OLD+'ReferenceDataService_v5_AllSectionsLeaderMatch.gs',OLD+'WebAppApi_v3_TabValidationAndPHSOverride.gs',NEW+'Step5WebApiTest.gs'];
files.forEach(f=>g.load(f));
try{ g.ctx.runStep5WebApiTest(); }catch(e){ g.logs.push('THROWN: '+e.message) }
console.log(g.logs.filter(l=>!/CACHE|REF FAST|INFO2026 FAST|download/.test(l)).join('\n'));
if(process.argv[3]==='dump'){ const b=g.ctx.apiBootstrap(); const l=g.ctx.apiLoadJob(b.jobs[0].jobKey); console.log(l.workerOptions.map(w=>[w.sourceNameRow,w.displayLabel,w.attendanceCell,Object.values(w.qualifications).map(x=>x?1:0).join('')].join(' | ')).join('\n')); }
