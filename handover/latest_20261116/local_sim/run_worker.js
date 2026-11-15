const path=require('path'),fs=require('fs');const {makeContext,Blob}=require('./gasmock');
const T=path.join(__dirname,'../tools/node_modules/');
const SRC=path.join(__dirname,'../zip/SOURCE_DATA/'), OLD=path.join(__dirname,'../zip/CODE/CURRENT_PROPOSED/'), NEW='/mnt/project-files/handover_review/gas/';
const out=path.join(__dirname,'../worker_out'); fs.mkdirSync(out,{recursive:true});
const g=makeContext({props:{BOX_TROUBLE_LIST_FOLDER_ID:'F_TL',BOX_INFO2026_FILE_ID:'INFO',BOX_WORKER_MASTER_FOLDER_ID:'F_WK',BOX_TEST_FOLDER_ID:'F_OUT',BOX_EMERG_MASTER_PDF_FILE_ID:'MASTER',BOX_PDF_FONT_MEIRYO_FILE_ID:'FONT'},
 files:{TL1:{path:path.join(__dirname,'../fixtures/TL_zentou.xlsx'),name:'EFTトラブル管理リストRev1.1_20260928.xlsx',modified_at:'2026-09-28T07:00:00+09:00'},
        INFO:{path:path.join(__dirname,'../fixtures/Info_synthetic_leaders.xlsx'),name:'Info2026_r1.xlsx'},
        WK:{path:SRC+'中日本装置課 安全管理体制図rev.159.xlsx',name:'中日本装置課 安全管理体制図rev.159.xlsx',modified_at:'2026-09-20'},
        MASTER:{path:SRC+'Emerg_Master_Blank_v2.pdf',name:'Emerg_Master_Blank_v2.pdf'},
        FONT:{path:'/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',name:'ipag.ttf'}},
 folders:{F_TL:['TL1'],F_WK:['WK']}});
const store={};
g.ctx.ensurePdfRuntime_=()=>({PDFLib:require(T+'pdf-lib'),fontkit:require(T+'@pdf-lib/fontkit')});
g.ctx.boxUploadOrNewVersion_=(folderId,name,blob)=>{const mode=store[name]?'NEW_VERSION':'NEW_FILE';store[name]=store[name]||('F'+Object.keys(store).length+100);fs.writeFileSync(path.join(out,name),blob.buf);return {id:store[name],uploadMode:mode};};
[NEW+'TroubleListReader.gs',NEW+'JobDataService.gs',NEW+'ReferenceDataService.gs',OLD+'WebAppApi_v3_TabValidationAndPHSOverride.gs',NEW+'WorkerLedgerService.gs'].forEach(f=>g.load(f));
g.ctx.unsignedBytes_=(a)=>Uint8Array.from(a,b=>b&255); g.ctx.signedBytes_=(u)=>Array.from(u,b=>b>127?b-256:b);
try{ g.ctx.runWorkerLedgerPreviewTest(); }catch(e){ g.logs.push('THROWN '+e.stack) }
console.log(g.logs.filter(l=>/WORKER LEDGER|W\d|WRITTEN|THROWN|RESULT/.test(l)).join('\n')); console.log(fs.readdirSync(out));
