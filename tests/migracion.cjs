// Ejecutar desde la raíz: node tests/migracion.cjs
// Las sesiones de partida se escriben con las funciones REALES del HTML en HEAD.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const oldHtml = execFileSync('git', ['show', 'HEAD:index.html'], {encoding:'utf8'});
const newHtml = fs.readFileSync('index.html', 'utf8');
const KEY = 'workoutSessionsEmilia', CYCLES = KEY+'Cycles', REST = 'workoutRestEmilia';
const plain = x => JSON.parse(JSON.stringify(x));

function boot(html, storage = new Map(), failWrite = () => false) {
  const elements = new Map(), intervals = [], windowEvents = {};
  let blob, fileText;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      innerHTML:'', textContent:'', files:[], value:'', attributes:{}, events:{},
      scrollLeft:0, scrollWidth:300, clientWidth:300,
      classList:{add(){},remove(){}}, querySelectorAll(){return []},
      setAttribute(k,v){this.attributes[k]=String(v)},
      addEventListener(k,fn){this.events[k]=fn}, click(){this.clicked=true}
    });
    return elements.get(id);
  }
  const context = vm.createContext({requestAnimationFrame(){return 1},cancelAnimationFrame(){},console, Date, Math, JSON, Number, String, Boolean,
    Object, Array, Set, Map, Intl, Error, Blob,
    URL:{createObjectURL(b){blob=b;return 'blob:test'},revokeObjectURL(){}},
    FileReader:class {readAsText(){this.result=fileText;this.onload()}},
    setTimeout(){},clearTimeout(){},setInterval(fn){intervals.push(fn)},clearInterval(){},
    confirm:()=>true, navigator:{}, window:{scrollTo(){},addEventListener(k,fn){windowEvents[k]=fn}},
    document:{getElementById:element,addEventListener(){},createElement:()=>element('anchor')},
    localStorage:{getItem:k=>storage.get(k)??null,
      setItem(k,v){if(failWrite(k,v))throw Error('QuotaExceededError');storage.set(k,String(v))},
      removeItem:k=>storage.delete(k)}
  });
  const run = code => vm.runInContext(code, context);
  run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  return {run,storage,element,context,intervals,
    downloaded:()=>blob,
    importFile(text){fileText=text;element('importFile').events.change({target:{files:[{}],value:''}})}};
}
function containsOriginal(original, migrated, path='session') {
  for (const [key,value] of Object.entries(original)) {
    if (value && typeof value==='object') containsOriginal(value,migrated[key],path+'.'+key);
    else assert.equal(migrated[key],value,path+'.'+key);
  }
}
const near = (a,b,label) => assert.ok(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);

async function main() {
  const old = boot(oldHtml);
  old.run(`setRest(135)`);
  const defaults = plain(old.run('EXERCISES'));
  // Each exercise appears in kg and lbs on different dates. Different body mass,
  // durations, ROMs, 5RMs, two rows and several sets per exercise.
  old.run(`['2026-03-01','2026-06-15','2026-10-01','2026-10-19'].forEach((date,day)=>{
    load(date);updateSetting('bodyweight',61.2+day*1.3);updateSetting('workoutTime',35+day*10);
    currentSession.exercises.forEach((ex,i)=>{
      exerciseIndex=i;if((day+i)%2)changeUnit('lbs');
      updateConfig('fiveRM',65+i*3+day);updateConfig('rom',.23+i*.025+day*.01);
      addSet();updateSet(0,'sets',2);updateSet(0,'reps',5+day);
      updateSet(0,'weight',ASSISTED.includes(ex.name)?-15:20+i*3+day);
      repeatSet();updateSet(1,'sets',1);updateSet(1,'reps',8);
      updateSet(1,'weight',ASSISTED.includes(ex.name)?-10:17+i*3+day);
    });save();
  })`);
  const beforeRaw = old.storage.get(KEY), before = JSON.parse(beforeRaw);
  assert.equal(before.length,4); // Current HEAD keeps empty drafts out of storage.
  assert.equal(old.run('sessions().filter(trained).length'),4);
  const oldMetrics = new Map(before.map(s=>{
    old.context.fixture=s;
    return [s.date,plain(old.run('({totals:totals(fixture),ex:fixture.exercises.map(e=>exStats(e,fixture))})'))];
  }));
  // Preserve any backup already made by HEAD, and also test a fresh migration backup.
  const existingBackup=old.storage.get(KEY+'_respaldo_v2');
  const upgraded=boot(newHtml,new Map(old.storage));
  assert.equal(upgraded.storage.get(KEY+'_respaldo_v2'),existingBackup);
  const migrationStorage=new Map(old.storage);migrationStorage.delete(KEY+'_respaldo_v2');
  const app = boot(newHtml, migrationStorage);
  app.run('backupData()'); // First-write backup; HEAD sessions already use calculationVersion 2.0.
  assert.deepEqual(plain(app.run('EXERCISES')),defaults,'Exact exercise names/order/properties');
  assert.equal(app.run('STORAGE_KEY'),KEY);
  assert.equal(app.run('CYCLES_KEY'),CYCLES);
  assert.equal(app.storage.get(REST),'135');
  assert.equal(app.storage.get('workoutRestLuis'),undefined);
  const backup = JSON.parse(app.storage.get(KEY+'_respaldo_v2'));
  assert.equal(backup.rawSessions,beforeRaw,'Byte-for-byte original storage');
  assert.deepEqual(backup.sessions,before);
  assert.equal(backup.rest,'135');
  const after = plain(app.run('sessions()'));
  assert.deepEqual(after.map(s=>s.date),before.map(s=>s.date));
  const changes=[];
  for (const s of before) {
    const migrated=after.find(n=>n.date===s.date);
    containsOriginal(s,migrated);
    app.context.fixture=migrated;
    const now=plain(app.run('({totals:totals(fixture),ex:fixture.exercises.map(e=>exStats(e,fixture))})'));
    const was=oldMetrics.get(s.date);
    for(let i=0;i<s.exercises.length;i++) {
      const name=s.exercises[i].name, base=defaults[name], cfg=s.exerciseConfigs[name];
      const a=was.ex[i], b=now.ex[i];
      // Independent expected delta for removing the bar (zero for Emilia).
      const bar=base.usesBodyweight?0:(base.barWeight||0);
      near(a.volume,b.volume,name+' volume');
      near(a.force-b.force,bar*9.8*a.totalReps,name+' force delta');
      near(a.work-b.work,bar*9.8*a.totalReps*cfg.rom,name+' work delta');
      near(a.maxTotalWeight-b.maxTotalWeight,a.totalReps?bar:0,name+' max delta');
      for(const k of ['totalSets','totalReps','oneRM'])near(a[k],b[k],name+' '+k);
      if(a.totalReps)near(a.intensity-b.intensity,a.oneRM?100*bar/a.oneRM:0,name+' intensity delta');
      else assert.equal(b.intensity,null); // Old zero now correctly means missing data.
    }
    for(const k of ['volume','work','watts'])near(was.totals[k],now.totals[k],s.date+' '+k);
    if(s.exercises.some(e=>e.sets.length))near(was.totals.intensity,now.totals.intensity,s.date+' intensity');
    changes.push({date:s.date,volume:now.totals.volume,work:now.totals.work,
      deltaVolume:now.totals.volume-was.totals.volume,deltaWork:now.totals.work-was.totals.work});
  }
  // Reloading must not replace the original backup or historical configs.
  const backupRaw=app.storage.get(KEY+'_respaldo_v2');
  const reloaded=boot(newHtml,new Map(app.storage));
  assert.equal(reloaded.storage.get(KEY+'_respaldo_v2'),backupRaw);
  assert.deepEqual(plain(reloaded.run('sessions()')),after);
  for(const date of before.map(s=>s.date)) {
    app.run(`load('${date}');go('session');go('settings');go('history');go('cycles')`);
    for(let i=0;i<9;i++)app.run(`go('train',${i});parametersOpen=true;renderTrain()`);
  }
  app.run(`go('history')`);
  assert.equal((app.element('app').innerHTML.match(/class="bw-card history-metric"/g)||[]).length,18);
  // Exercise the actual Blob download and file-input import, including cycles.
  app.run(`load('2026-10-19');newCycle();cycleDraft.name='Emilia';cycleDraft.startDate='2026-10-01';
    selectCycleExercise('Peso Muerto Smith',true);generatePlan(cycleDraft);saveCycle();activateCycle(cycles()[0].id);
    exportData()`);
  assert.equal(app.element('anchor').download,'entrenamiento_emilia_'+app.run('today()')+'.json');
  const json=await app.downloaded().text(), payload=JSON.parse(json);
  const imported=boot(newHtml);
  imported.importFile(json);
  assert.deepEqual(plain(imported.run('sessions()')),payload.sessions);
  assert.deepEqual(plain(imported.run('cycles()')),payload.cycles);
  imported.run(`load('2026-10-19');exportData()`);
  assert.deepEqual(JSON.parse(await imported.downloaded().text()),payload);
  // Old array imports, conflict preservation and corrupt files.
  const legacy=boot(newHtml);legacy.importFile(beforeRaw);
  before.forEach(s=>containsOriginal(s,plain(legacy.run('sessions()')).find(n=>n.date===s.date)));
  const safe=legacy.storage.get(KEY);legacy.importFile('{invalid');assert.equal(legacy.storage.get(KEY),safe);
  legacy.importFile(JSON.stringify([{...before[0],bodyweight:999}]));assert.equal(legacy.storage.get(KEY),safe);
  // Corrupt existing storage must remain untouched at initialization and autosave.
  for(const invalid of ['{broken','', '{}', '[{}]']) {
    const corrupt=boot(newHtml,new Map([[KEY,invalid]]));
    assert.ok(corrupt.element('app').innerHTML.includes('Datos protegidos'));
    corrupt.intervals.forEach(fn=>fn());assert.equal(corrupt.storage.get(KEY),invalid);
    assert.equal(corrupt.storage.get(KEY+'_respaldo_v2'),undefined);
  }
  // Backup quota failure blocks migration; failure writing migrated data preserves original.
  for(const failedKey of [KEY+'_respaldo_v2',KEY]) {
    const quotaStorage=new Map(old.storage);quotaStorage.delete(KEY+'_respaldo_v2');
    const legacyRaw=JSON.stringify(before.map(({summary,...session})=>session));
    quotaStorage.set(KEY,legacyRaw);
    const failed=boot(newHtml,quotaStorage,k=>k===failedKey);
    assert.equal(failed.storage.get(KEY),legacyRaw);
    assert.ok(failed.element('app').innerHTML.includes('Datos protegidos'));
    failed.intervals.forEach(fn=>fn());assert.equal(failed.storage.get(KEY),legacyRaw);
  }
  // Setting barWeight to a nonzero value cannot affect any NEW metric.
  app.run(`load('2026-10-19')`);
  const metrics=plain(app.run('buildSummary(currentSession)'));
  app.run(`Object.values(EXERCISES).forEach(c=>c.barWeight=20);
    Object.values(currentSession.exerciseConfigs).forEach(c=>c.barWeight=20)`);
  assert.deepEqual(plain(app.run('buildSummary(currentSession)')),metrics);
  // Editable bodyweight: negative assistance and zero lastre use system mass.
  app.run(`exerciseIndex=0;updateConfig('usesBodyweight',true);updateConfig('fiveRM',100);
    currentSession.bodyweight=64;currentSession.exerciseConfigs[currentSession.exercises[0].name].unit='kg';
    currentSession.exercises[0].sets=[{sets:2,reps:5,weight:-14},{sets:1,reps:5,weight:0}];save();
    parametersOpen=true;renderTrain()`);
  assert.equal(app.run('exStats(currentSession.exercises[0]).volume'),820);
  assert.ok(app.element('app').innerHTML.includes('5RM total (cuerpo + lastre)'));
  assert.ok(!/AndroidBridge|androidBack|fonts\.googleapis|fonts\.gstatic/.test(newHtml));
  assert.deepEqual(JSON.parse(fs.readFileSync('manifest.json','utf8')),
    JSON.parse(execFileSync('git',['show','HEAD:manifest.json'],{encoding:'utf8'})));
  for(const meta of oldHtml.matchAll(/<meta[^>]+>/g))assert.ok(newHtml.includes(meta[0]));
  assert.ok(newHtml.includes("register('./sw.js?v=6')"));
  const sw=fs.readFileSync('sw.js','utf8');assert.ok(sw.includes("CACHE='emilia-workout-v6'"));
  for(const name of fs.readdirSync('fonts'))assert.ok(sw.includes('./fonts/'+name));
  require('./regresiones.cjs');
  console.log('PASS: HEAD real → nueva app, 4 fechas entrenadas, 9 ejercicios/fecha, kg/lbs, 5RM/ROM/peso corporal exactos, Blob → archivo → importación sin pérdida.');
  console.table(changes);
  console.log('Barra Emilia: Δ volumen = 0 kg·reps; fuerza = 0 N; trabajo = 0 J; potencia = 0 W; intensidad legada = 0 pp. Asistidos de origen: ninguno.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
