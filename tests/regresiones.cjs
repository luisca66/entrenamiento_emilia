const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),source=html.split('<script>')[1].split('</script>')[0];
const elements=new Map(),listeners={},storage=new Map(),documentListeners={};
function element(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',files:[],scrollLeft:0,scrollWidth:300,clientWidth:300,querySelectorAll(){return []},classList:{add(){},remove(){}},addEventListener(event,fn){listeners[id+':'+event]=fn},attributes:{},setAttribute(k,v){this.attributes[k]=String(v)},click(){}});return elements.get(id)}
const frames=new Map();let nextFrame=0;
function flushFrames(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn())}
const context=vm.createContext({requestAnimationFrame(fn){frames.set(++nextFrame,fn);return nextFrame},cancelAnimationFrame(id){frames.delete(id)},console,Date,Math,JSON,Number,String,Boolean,Object,Array,Set,Map,Intl,Error,Blob,URL,setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},confirm:()=>true,navigator:{},window:{scrollTo(){}},document:{getElementById:element,addEventListener(type,fn){documentListeners[type]=fn},createElement:()=>element('anchor')},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)}});
const old=[{date:'2026-10-01',bodyweight:80,workoutTime:60,custom:{keep:true},exercises:[{name:'Peso Muerto Smith',extra:'keep exercise',sets:[{sets:1,reps:5,weight:80,tag:'primera'},{sets:1,reps:5,weight:72}]}],exerciseConfigs:{'Peso Muerto Smith':{fiveRM:100,rom:.46,unit:'kg',usesBodyweight:false,extra:'keep config'}}},{date:'2026-10-02',bodyweight:81,workoutTime:50,exercises:[{name:'Remo en Polea',sets:[{sets:2,reps:5,weight:0}]}],exerciseConfigs:{'Remo en Polea':{fiveRM:100,rom:.5,unit:'kg',usesBodyweight:true}}},{date:'2026-10-03',bodyweight:80,workoutTime:60,exercises:[],exerciseConfigs:{}}];
storage.set('workoutSessionsEmilia',JSON.stringify(old));vm.runInContext(source,context);const run=s=>vm.runInContext(s,context),plain=value=>JSON.parse(JSON.stringify(value));
function originalFields(a,b){for(const k of Object.keys(a)){if(a[k]&&typeof a[k]==='object')originalFields(a[k],b[k]);else assert.equal(b[k],a[k],k)}}
const migrated=JSON.parse(storage.get('workoutSessionsEmilia'));assert.equal(migrated.length,3);old.forEach((s,i)=>originalFields(s,migrated[i]));assert.deepEqual(JSON.parse(storage.get('workoutSessionsEmilia_respaldo_v2')).sessions,old);
const s=migrated[0].summary;assert.equal(s.totalSets,2);assert.equal(s.totalReps,10);assert.equal(s.volumeLoadKgReps,760);assert.equal(s.meanLoadKgPerRep,76);assert.ok(Math.abs(s.meanRelativeIntensityPct-67.5488)<1e-8);assert.equal(s.intensityCoveragePctReps,100);assert.ok(Math.abs(s.estimatedConcentricWorkJ-3426.08)<1e-8);assert.equal(migrated[1].summary.volumeLoadKgReps,810);assert.equal(migrated[2].summary.totalSets,0);assert.equal(migrated[2].summary.meanRelativeIntensityPct,null);
run(`load('2026-10-01');save();go('history')`);old[0]&&originalFields(old[0],JSON.parse(storage.get('workoutSessionsEmilia')).find(s=>s.date===old[0].date));assert.ok(!element('app').innerHTML.includes("openHistory('2026-10-03')"));
run(`newCycle();cycleDraft.name='Prueba Pavel';cycleDraft.startDate='2026-10-10';cycleDraft.weeks=4;cycleDraft.sessionsPerWeek=2;selectCycleExercise('Peso Muerto Smith',true);Object.assign(cycleDraft.progression['Peso Muerto Smith'],{initialTopKg:80,incrementKg:2.5,backoffRatio:.9});generatePlan(cycleDraft);validateCycle(cycleDraft)`);
const c=plain(run('cycleDraft'));assert.deepEqual(c.weeklyPlan.flatMap(w=>w.workouts.map(t=>t.exercises[0].sets[0].loadKg)),[80,82.5,85,87.5,90,92.5,95,97.5]);assert.deepEqual(c.weeklyPlan[0].workouts[0].exercises[0].sets,[{count:1,reps:5,loadKg:80},{count:1,reps:5,loadKg:72}]);assert.equal(c.weeklyPlan[0].workouts[1].exercises[0].sets[1].loadKg,74.25);
run(`cycleDraft.type='pavel_step';cycleDraft.progression['Peso Muerto Smith'].repeatWorkouts=3;generatePlan(cycleDraft)`);assert.deepEqual(plain(run('cycleDraft.weeklyPlan.flatMap(w=>w.workouts.map(t=>t.exercises[0].sets[0].loadKg))')),[80,80,80,82.5,82.5,82.5,85,85]);
run(`cycleDraft.type='pavel_linear';generatePlan(cycleDraft);saveCycle();activateCycle(cycles()[0].id);load('2026-10-10')`);assert.equal(run('currentPlan().index'),1);assert.equal(run('sessions().some(s=>s.date===currentSession.date)'),false);
run(`exerciseIndex=currentSession.exercises.findIndex(e=>e.name==='Peso Muerto Smith');applyPlan()`);assert.equal(run('currentSession.summary.volumeLoadKgReps'),760);assert.equal(run('currentSession.cycleWeek'),1);assert.equal(run('currentSession.planSnapshot.workout.exercises[0].sets[0].loadKg'),80);
let comparison=plain(run('weekComparison(cycles()[0],cycles()[0].weeklyPlan[0])'));assert.equal(comparison.actual.sessions,1);assert.equal(comparison.actual.totalReps,10);assert.equal(comparison.planned.totalReps,20);assert.equal(comparison.planned.volumeLoadKgReps,1543.75);
run(`load('2026-10-30')`);assert.equal(run('currentPlan().index'),2);assert.equal(run('currentPlan().week'),1);run(`load('2026-10-10')`);assert.equal(run('currentPlan().index'),1);
run(`editCycle(cycles()[0].id);cycleDraft.weeklyPlan[0].workouts[0].exercises[0].sets[0].loadKg=999;saveCycle()`);assert.equal(run('currentPlan().workout.exercises[0].sets[0].loadKg'),80);assert.equal(run('weekComparison(cycles()[0],cycles()[0].weeklyPlan[0]).planned.volumeLoadKgReps'),1543.75);
run(`currentSession.exercises.push({name:'Desconocido',sets:[{sets:1,reps:10,weight:20,extra:'keep'}]});currentSession.exerciseConfigs.Desconocido={fiveRM:0,rom:.2,unit:'kg',usesBodyweight:false};currentSession.exerciseConfigs['Peso Muerto Smith'].fiveRM=100;currentSession.sessionRpe=8;currentSession.notes='Nota <prueba>';save()`);assert.equal(run('currentSession.summary.intensityCoveragePctReps'),50);assert.equal(run('currentSession.summary.meanRelativeIntensityPct'),67.5488);assert.equal(run('currentSession.summary.sessionRpe'),8);
const exported=plain(run('exportPayload()'));storage.set('workoutSessionsEmilia','[]');storage.set('workoutSessionsEmiliaCycles','[]');context.payload=exported;run('importPayload(payload)');assert.deepEqual(plain(run('sessions()')),exported.sessions);assert.deepEqual(plain(run('cycles()')),exported.cycles);
storage.set('workoutSessionsEmilia','[]');storage.set('workoutSessionsEmiliaCycles','[]');context.legacy=old;run('importPayload(legacy)');old.forEach((s,i)=>originalFields(s,plain(run('sessions()'))[i]));
const before=storage.get('workoutSessionsEmilia');assert.throws(()=>run(`importPayload({schemaVersion:2,sessions:[{date:'incorrecta'}],cycles:[]})`));assert.equal(storage.get('workoutSessionsEmilia'),before);run('importPayload(payload)');assert.equal(run(`sessions().find(s=>s.date==='2026-10-01').custom.keep`),true);
run(`load('2026-10-10');renderSession();go('train',currentSession.exercises.findIndex(e=>e.name==='Remo en Polea'));updateConfig('usesBodyweight',true);parametersOpen=true;renderTrain()`);assert.ok(element('app').innerHTML.includes('5RM total (cuerpo + lastre)'));assert.ok(element('app').innerHTML.includes('Sin dato'));
run(`go('history');renderHistory();go('settings');go('cycles');editCycle(cycles()[0].id)`);assert.ok(element('app').innerHTML.includes('Guardar ciclo'));
// Quota failure must leave both original collections unchanged.
const oldC=storage.get('workoutSessionsEmiliaCycles'),oldS=storage.get('workoutSessionsEmilia'),setter=context.localStorage.setItem;let fail=true;context.localStorage.setItem=(k,v)=>{if(k==='workoutSessionsEmilia'&&fail){fail=false;throw Error('quota')}setter(k,v)};assert.throws(()=>run('writeCollections([],[])'));assert.equal(storage.get('workoutSessionsEmilia'),oldS);assert.equal(storage.get('workoutSessionsEmiliaCycles'),oldC);context.localStorage.setItem=setter;
// Compatible envelope v1; structural edits require regenerating all workouts.
context.compatible={...exported,schemaVersion:1};assert.doesNotThrow(()=>run('importPayload(compatible)'));run(`editCycle(cycles()[0].id);selectCycleExercise('Sentadillas Smith',true)`);assert.throws(()=>run('validateCycle(cycleDraft)'));run('cycleDraft=null');
// Existing training must never acquire cycle metadata just because it is viewed/saved.
run(`currentSession=normalize({...blankSession('2026-10-11'),exercises:[{name:'Peso Muerto Smith',sets:[{sets:1,reps:5,weight:40}]}]});localStorage.setItem(STORAGE_KEY,JSON.stringify([...sessions(),currentSession]));load('2026-10-11');save()`);assert.equal(run('currentSession.cycleId'),undefined);assert.equal(run('currentPlan()'),null);
// Future extension fields survive recalculation, including inside exercise summaries.
run(`currentSession.extraSession={keep:1};currentSession.summary.extraSummary={keep:2};currentSession.summary.byExercise[0].extraExerciseSummary={keep:3};save();load('2026-10-11')`);assert.equal(run('currentSession.extraSession.keep'),1);assert.equal(run('currentSession.summary.extraSummary.keep'),2);assert.equal(run('currentSession.summary.byExercise[0].extraExerciseSummary.keep'),3);
// Compare intensity against the fixed plan reference even if session 5RM differs.
run(`load('2026-10-10');currentSession.exerciseConfigs['Peso Muerto Smith'].fiveRM=200;save()`);assert.ok(Math.abs(run('weekComparison(cycles()[0],cycles()[0].weeklyPlan[0]).actual.meanRelativeIntensityPct')-67.5488)<1e-8);assert.ok(run('currentSession.summary.meanRelativeIntensityPct')<40);
// Export includes unsaved in-memory changes even when saving runs out of space.
context.localStorage.setItem=()=>{throw Error('quota')};run(`currentSession.notes='Cambios sin guardar';save()`);assert.equal(plain(run('exportPayload()')).sessions.find(s=>s.date==='2026-10-10').notes,'Cambios sin guardar');context.localStorage.setItem=setter;
// Opening an earlier date must not reuse a workout already assigned to a later date.
run(`load('2026-11-01');exerciseIndex=currentSession.exercises.findIndex(e=>e.name==='Peso Muerto Smith');applyPlan();load('2026-10-12')`);assert.equal(run('currentPlan().index'),3);
// No network fonts/scripts/styles; every bundled font exists and is a real TTF.
assert.ok(!/fonts\.googleapis|fonts\.gstatic|<script[^>]+src=/.test(html));for(const match of html.matchAll(/url\('fonts\/([^']+)'\)/g)){const bytes=fs.readFileSync('fonts/'+match[1]);assert.equal(bytes.readUInt32BE(0),0x00010000)}
// Phase 4: all nine global metrics, shared dates, cycle bands, sparse values and gestures.
const histStorage=storage.get('workoutSessionsEmilia'),cycleStorage=storage.get('workoutSessionsEmiliaCycles');
run(`go('history')`);
let rendered=element('app').innerHTML;
assert.equal((rendered.match(/class="bw-card history-metric"/g)||[]).length,18);
assert.ok(!rendered.includes('<select'));
assert.ok(rendered.indexOf('data-metric="bodyweightKg"')<rendered.indexOf('data-metric="volumeLoadKgReps"'));
assert.ok(rendered.indexOf('data-metric="sessionRpe"')<rendered.indexOf('class="session-list"'));
assert.ok(rendered.includes('class="cycle-band"'));assert.ok(rendered.includes('Aún sin datos suficientes'));
// Uneven dates: all metrics share positions, even when intensity/RPE has holes.
run(`historyFixture=['2026-10-01','2026-10-04','2026-10-30'].map((date,i)=>{const s=normalize({...sessions()[0],date});s.summary.sessionRpe=i===1?8:null;s.summary.meanRelativeIntensityPct=i===1?null:60+i;return s});historyCharts(historyFixture)`);
assert.equal(run('Object.keys(historyPlots).length'),18);
assert.ok(Math.abs(run("historyPlots.totalSets.points[1].x")-(40+288*3/29))<1e-8);
assert.equal(run('historyPlots.bodyweightKg.points[2].x'),328);
assert.equal(run('historyPlots.meanRelativeIntensityPct.points[1].x'),328);
assert.equal(run('historyPlots.sessionRpe.points.length'),1);
run(`historyShow('2026-10-04')`);
for(const key of plain(run('Object.keys(historyMetrics)'))){assert.ok(element('historyReadout-'+key).innerHTML.includes('4 OCT'));assert.equal(element('historyCross-'+key).attributes.x1,String(run("historyX('2026-10-04')")))}
assert.ok(element('historyReadout-meanRelativeIntensityPct').innerHTML.includes('Sin dato'));
assert.equal(element('historyFocus-meanRelativeIntensityPct').attributes.visibility,'hidden');
run('historyReset()');assert.ok(element('historyReadout-sessionRpe').innerHTML.includes('Sin dato'));
assert.equal(element('historyCross-totalSets').attributes.visibility,'hidden');
let captures=0,releases=0,prevented=0,captured=false;
context.pointer={type:'pointerup',pointerId:7,pointerType:'touch',button:0,clientX:70,clientY:20,currentTarget:{parentElement:element('historyScroll-totalSets'),getBoundingClientRect:()=>({left:0,width:340}),setPointerCapture(){captures++;captured=true},hasPointerCapture:()=>captured,releasePointerCapture(){releases++;captured=false}},preventDefault(){prevented++}};
run('historyPointerDown(pointer)');context.pointer.clientX=120;run('historyPointerMove(pointer)');assert.equal(captures,1);assert.equal(prevented,1);
run('historyPointerEnd(pointer)');assert.equal(releases,1);assert.equal(run('historyGesture'),null);assert.equal(element('historyCross-totalSets').attributes.visibility,'hidden');
context.pointer.clientX=70;context.pointer.clientY=20;run('historyPointerDown(pointer)');context.pointer.clientY=80;run('historyPointerMove(pointer)');assert.equal(captures,1);assert.equal(prevented,1);run('historyPointerEnd(pointer)');
context.pointer.clientY=20;run('historyPointerDown(pointer);historyPointerEnd(pointer)');assert.equal(element('historyCross-totalSets').attributes.visibility,'visible');
run('historyPointerDown(pointer);historyPointerEnd(pointer)'); assert.equal(element('historyCross-totalSets').attributes.visibility,'hidden'); // Same-point tap toggles off.
assert.match(html,/\.history-svg\{touch-action:pan-y/);assert.ok(!html.includes('touch-action:none'));
rendered=run('historyCharts(historyFixture)');assert.equal((rendered.split('Por ejercicio')[0].match(/class="cycle-band"/g)||[]).length,8);assert.ok(rendered.includes('Prueba Pavel'));
assert.equal((run('historyCharts([])').match(/Aún sin datos suficientes/g)||[]).length,9);
assert.equal((run('historyCharts([historyFixture[0]])').split('Por ejercicio')[0].match(/Aún sin datos suficientes/g)||[]).length,9);
assert.equal(storage.get('workoutSessionsEmilia'),histStorage);assert.equal(storage.get('workoutSessionsEmiliaCycles'),cycleStorage);
// Phase 5: 150 sessions spanning twelve months; simulated layout matches generated width.
run(`yearFixture=Array.from({length:150},(_,i)=>{const s=normalize({...historyFixture[0],date:addDays('2025-10-16',Math.round(i*365/149))});s.summary.sessionRpe=6+i%4;s.summary.meanRelativeIntensityPct=60+i%20;return s});historyCharts(yearFixture)`);
assert.equal(run('historyDates.length'),150);assert.ok(Math.abs(run('historyFactor')-365/70)<1e-10);
rendered=run('historyCharts(yearFixture)');
assert.equal((rendered.split('Por ejercicio')[0].match(/class="history-scroll"/g)||[]).length,9);
assert.equal((rendered.split('Por ejercicio')[0].match(/class="history-axis"/g)||[]).length,9);
assert.equal((rendered.split('Por ejercicio')[0].match(new RegExp('style="width:'+String(100*run('historyFactor')).replace('.', '\\.')+'%"','g'))||[]).length,9);
assert.ok(rendered.includes('onscroll="historyScrolled(event)"'));
assert.ok(!rendered.includes('onpointerleave'));
const keys=plain(run('Object.keys(historyPlots)'));
for(const key of keys){const el=element('historyScroll-'+key);el.clientWidth=300;el.scrollWidth=300*run('historyFactor');el.scrollLeft=0}
run('historyInit()');
for(const key of keys){const el=element('historyScroll-'+key);assert.ok(Math.abs(el.scrollLeft-(el.scrollWidth-el.clientWidth))<1e-8)}
const scaleBefore=plain(run('Object.fromEntries(Object.entries(historyPlots).map(([key,p])=>[key,[p.lo,p.hi]]))'));
// Native scrolling (scrollbar/trackpad) and pointer dragging both propagate the range.
element('historyScroll-totalSets').scrollLeft=420;context.scrollEvent={currentTarget:element('historyScroll-totalSets')};run('historyScrolled(scrollEvent)');flushFrames();
for(const key of keys)assert.ok(Math.abs(element('historyScroll-'+key).scrollLeft-420)<1e-8);
context.pointer.currentTarget.parentElement=element('historyScroll-totalSets');context.pointer.currentTarget.getBoundingClientRect=()=>({left:-420,width:300*run('historyFactor')});
context.pointer.clientX=80;context.pointer.clientY=20;run('historyPointerDown(pointer)');context.pointer.clientX=20;run('historyPointerMove(pointer);historyPointerEnd(pointer)');flushFrames();
for(const key of keys)assert.ok(Math.abs(element('historyScroll-'+key).scrollLeft-480)<1e-8);
assert.equal(run('historySelected'),null);
// Tap persists through release and scrolling; all readouts/cursors share the session.
run('historyPointerDown(pointer);historyPointerEnd(pointer)');const selected=run('historySelected');assert.ok(selected);
for(const key of keys){if(!key.startsWith('exercise'))assert.ok(element('historyReadout-'+key).innerHTML.includes(run(`shortDate('${selected}')`)));assert.equal(element('historyCross-'+key).attributes.visibility,'visible')}
run('historySync(.5)');assert.equal(run('historySelected'),selected);
assert.deepEqual(plain(run('Object.fromEntries(Object.entries(historyPlots).map(([key,p])=>[key,[p.lo,p.hi]]))')),scaleBefore);
run('historyPointerDown(pointer);historyPointerEnd(pointer)');assert.equal(run('historySelected'),null);
run('historyPointerDown(pointer);historyPointerEnd(pointer)');context.pointer.type='pointercancel';run('historyPointerDown(pointer);historyPointerEnd(pointer)');assert.ok(run('historySelected'));context.pointer.type='pointerup';
documentListeners.pointerdown({target:{closest:()=>null}});assert.equal(run('historySelected'),null);
for(const key of keys)assert.equal(element('historyReadout-'+key).innerHTML,run(`historyReadout('${key}',historyPlots['${key}'].latest)`));
const offset=run('historyOffset');context.pointer.clientY=20;run('historyPointerDown(pointer)');context.pointer.clientY=90;run('historyPointerMove(pointer);historyPointerEnd(pointer)');assert.equal(run('historyOffset'),offset);assert.equal(run('historySelected'),null);
// Inclusive 70-day boundary has no overflow; 71 days does.
for(const days of [20,70,71]){
 run(`historyCharts([yearFixture[0],{...yearFixture[149],date:addDays(yearFixture[0].date,${days})}])`);
 assert.equal(run('historyFactor>1'),days>70);
 for(const key of keys){const el=element('historyScroll-'+key);el.scrollWidth=300*run('historyFactor');el.clientWidth=300;el.scrollLeft=0}
 run('historyInit()');for(const key of keys)assert.equal(element('historyScroll-'+key).scrollLeft>0,days>70);
}
assert.equal(storage.get('workoutSessionsEmilia'),histStorage);assert.equal(storage.get('workoutSessionsEmiliaCycles'),cycleStorage);
// Phase 6/6b: exercise total volume, sparse history, plan membership and overlapping lanes.
run(`phase6Names=Object.keys(EXERCISES);phase6Fixture=Array.from({length:150},(_,i)=>{
 const s=blankSession(addDays('2025-10-16',Math.round(i*365/149)));
 s.bodyweight=80+i/10;s.sessionRpe=7;
 s.exercises.forEach((ex,j)=>{if(j===8||i<j||i%3===1&&j===0)return;
  ex.sets=[{sets:2,reps:5,weight:100+i+j},{sets:1,reps:3,weight:110+i+j},{sets:0,reps:9,weight:9999},{sets:1,reps:0,weight:9999}];
  s.exerciseConfigs[ex.name].fiveRM=100;
 });
 s.exerciseConfigs[phase6Names[0]].unit='lbs';
 s.exerciseConfigs[phase6Names[3]].usesBodyweight=true;
 return normalize(s);
});
phase6Cycles=[{id:'overlapA',name:'Ciclo A',startDate:'2026-01-01',weeks:20,weeklyPlan:[{workouts:[{exercises:[{exerciseId:phase6Names[0]},{exerciseId:phase6Names[2]}]}]}]},
{id:'overlapB',name:'Ciclo B',startDate:'2026-02-01',weeks:20,weeklyPlan:[{workouts:[{exercises:[{exerciseId:phase6Names[1]},{exerciseId:phase6Names[2]}]}]}]}];
phase6Cycles=phase6Cycles.map(c=>{
 const names=c.weeklyPlan[0].workouts[0].exercises.map(e=>e.exerciseId);
 return generatePlan({...c,type:'free',status:'planned',sessionsPerWeek:1,references:clone(phase6Fixture[0].exerciseConfigs),progression:Object.fromEntries(names.map(n=>[n,{initialTopKg:20,incrementKg:0,backoffRatio:.9,repeatWorkouts:1,reps:5,series:2}]))});
});
localStorage.setItem(CYCLES_KEY,JSON.stringify(phase6Cycles));`);
const phase6Storage=storage.get('workoutSessionsEmilia'),phase6CycleStorage=storage.get('workoutSessionsEmiliaCycles');
rendered=run('historyCharts(phase6Fixture)');
assert.deepEqual(plain(run('Object.keys(historyPlots)')),[...plain(run('Object.keys(historyMetrics)')),...Array.from({length:9},(_,i)=>'exercise'+i)]);
assert.deepEqual([...rendered.matchAll(/data-metric="([^"]+)"/g)].map(m=>m[1]),plain(run('Object.keys(historyPlots)')));
assert.equal((rendered.split('Por ejercicio')[0].match(/class="bw-card history-metric"/g)||[]).length,9);
assert.equal((rendered.split('Por ejercicio')[1].match(/class="bw-card history-metric"/g)||[]).length,9);
const exerciseCards=[...rendered.matchAll(/<section class="bw-card history-metric" data-metric="exercise(\d)">([\s\S]*?)<\/section>/g)];
assert.equal(exerciseCards.length,9);
exerciseCards.forEach((m,i)=>{assert.ok(m[2].includes(run(`phase6Names[${i}]`)));assert.ok(m[2].includes('<div class="hint">Carga total</div>'));assert.ok(m[2].includes('<small>kg'))});
assert.ok(exerciseCards[8][2].includes('Aún sin registros'));assert.ok(!exerciseCards[8][2].includes('history-scroll'));
assert.equal(run('historyPlots.exercise8.points.length'),0);
assert.equal(run('historyPlots.exercise0.points.length'),100);
// All valid rows contribute sets × reps, with historical lbs converted to kg.
assert.ok(Math.abs(run('historyPlots.exercise0.latest.w')-(249*2*5+259*1*3)*.453592)<1e-8);
const bodyIndex=run('phase6Names.findIndex(n=>phase6Fixture[149].exerciseConfigs[n].usesBodyweight)');
// Body mass is included in every rep, together with each row's external load.
assert.equal(run(`historyPlots.exercise${bodyIndex}.latest.w`),(100+149+bodyIndex+94.9)*2*5+(110+149+bodyIndex+94.9)*1*3);
for(let i=0;i<8;i++){
 const points=plain(run(`historyPlots.exercise${i}.points`));
 for(const point of points){
  assert.equal(point.w,run(`phase6Fixture.find(s=>s.date==='${point.date}').summary.byExercise.find(e=>e.exerciseId===phase6Names[${i}]).volumeLoadKgReps`));
  assert.equal(point.x,run(`historyX('${point.date}')`));
  assert.equal(point.detail,'2×5 · 1×3');
 }
 assert.equal(run(`historyPlots.exercise${i}.first.date`),run(`historyPlots.exercise${i}.points[0].date`));
 assert.ok(run(`historyDelta('exercise${i}',historyPlots.exercise${i}.latest)`).includes(run(`shortDate(historyPlots.exercise${i}.first.date)`)));
}
assert.deepEqual(plain(run('historyPlots.exercise0.bands.map(b=>b.name)')),['Ciclo A']);
assert.deepEqual(plain(run('historyPlots.exercise1.bands.map(b=>b.name)')),['Ciclo B']);
assert.deepEqual(plain(run('historyPlots.exercise2.bands.map(b=>b.lane)')),[0,1]);
assert.equal(run('historyPlots.exercise3.bands.length'),0);
for(const key of plain(run('Object.keys(historyMetrics)')))assert.deepEqual(plain(run(`historyPlots.${key}.bands.map(b=>b.lane)`)),[0,1]);
assert.ok(exerciseCards[2][2].includes('data-cycle-lane="0"'));assert.ok(exerciseCards[2][2].includes('data-cycle-lane="1"'));
assert.ok(!exerciseCards[0][2].includes('Ciclo B'));assert.ok(!exerciseCards[1][2].includes('Ciclo A'));
assert.equal((rendered.match(/class="history-scroll"/g)||[]).length,17); // Empty card deliberately has no plot.
assert.equal((rendered.match(/class="history-axis"/g)||[]).length,17);
const phase6Keys=plain(run('Object.keys(historyPlots)'));
for(const key of phase6Keys){const el=element('historyScroll-'+key);el.scrollWidth=300*run('historyFactor');el.clientWidth=300;el.scrollLeft=0}
run('historyInit()');
context.scrollEvent={currentTarget:element('historyScroll-exercise0')};
element('historyScroll-exercise0').scrollLeft=123;run('historyScrolled(scrollEvent)');
element('historyScroll-exercise0').scrollLeft=234;run('historyScrolled(scrollEvent)');
assert.equal(frames.size,1);flushFrames();assert.equal(frames.size,0);
for(const key of phase6Keys)assert.ok(Math.abs(element('historyScroll-'+key).scrollLeft-234)<1e-8);
run('historyShow(phase6Fixture[149].date)');
for(const key of phase6Keys)assert.equal(element('historyCross-'+key).attributes.x1,String(run('historyX(phase6Fixture[149].date)')));
assert.ok(element('historyReadout-exercise0').innerHTML.includes('2×5 · 1×3'));
run('historyShow(phase6Fixture[1].date)');assert.ok(element('historyReadout-exercise0').innerHTML.includes('Sin dato'));assert.equal(element('historyFocus-exercise0').attributes.visibility,'hidden');
run('historyReset()');assert.ok(element('historyReadout-exercise0').innerHTML.includes(run('historyNumber(historyPlots.exercise0.latest.w)')));
assert.equal(storage.get('workoutSessionsEmilia'),phase6Storage);assert.equal(storage.get('workoutSessionsEmiliaCycles'),phase6CycleStorage);
for(const key of phase6Keys){
 if(!key.startsWith('exercise'))assert.deepEqual(plain(run(`historyPlots.${key}.samples.map(p=>p.w)`)),plain(run(`phase6Fixture.map(s=>s.summary.${key})`)));
}
// With data for every exercise, all 18 render the identical date viewport and scroll together.
rendered=run(`historyCharts(phase6Fixture.map(s=>normalize({...s,exercises:s.exercises.map((ex,i)=>i===8?{...ex,sets:[{sets:1,reps:5,weight:10}]}:ex)})))`);
assert.equal((rendered.match(/class="history-scroll"/g)||[]).length,18);
assert.equal((rendered.match(/class="history-axis"/g)||[]).length,18);
assert.equal(new Set([...rendered.matchAll(/viewBox="40 0 ([^ ]+) /g)].map(m=>m[1])).size,1);
run('historyInit();historySync(.25)');
for(const key of phase6Keys){const el=element('historyScroll-'+key);assert.equal(el.scrollLeft,(el.scrollWidth-el.clientWidth)*.25)}
run('historyShow(phase6Fixture[149].date)');
for(const key of phase6Keys)assert.equal(element('historyCross-'+key).attributes.x1,String(run('historyX(phase6Fixture[149].date)')));
// Sparse exercise keeps its own latest valid observation even if the last session omits it.
run(`historyCharts(phase6Fixture.map((s,i)=>i===149?normalize({...s,exercises:s.exercises.map((ex,j)=>j===0?{...ex,sets:[]}:ex)}):s))`);
assert.equal(run('historyPlots.exercise0.latest.date'),run('phase6Fixture[147].date'));
assert.equal(run('historyPlots.exercise0.first.date'),run('phase6Fixture[0].date'));
rendered=run(`historyCharts(phase6Fixture.map((s,i)=>normalize({...s,exercises:s.exercises.map((ex,j)=>j===7&&i!==20?{...ex,sets:[]}:ex)})))`);
assert.equal(run('historyPlots.exercise7.points.length'),1);
assert.equal(run('historyPlots.exercise7.first.date'),run('phase6Fixture[20].date'));
const singleCard=rendered.match(/data-metric="exercise7">([\s\S]*?)<\/section>/)[1];
assert.ok(singleCard.includes('Aún sin datos suficientes'));assert.ok(!singleCard.includes('history-scroll'));
// A single valid exercise session remains compact; its baseline is its own first date.
rendered=run('historyCharts([phase6Fixture[0]])');assert.ok(rendered.includes('Aún sin datos suficientes'));assert.equal((rendered.match(/class="history-scroll"/g)||[]).length,0);
// Emilia permits bodyweight and negative assistance through per-session configs.
// Hist must reuse that session's summary, including historical lbs, without writes.
const beforeAssistance=[...storage];
run(`assistanceFixture=['2026-03-01','2026-03-03'].map((date,i)=>{
 const s=blankSession(date);s.bodyweight=64;
 const name=Object.keys(EXERCISES)[0];
 s.exerciseConfigs[name].usesBodyweight=true;s.exerciseConfigs[name].unit=i?'lbs':'kg';
 const unit=i?LBS_TO_KG:1;
 s.exercises[0].sets=[{sets:2,reps:5,weight:-14/unit},{sets:1,reps:5,weight:0},{sets:1,reps:3,weight:10/unit},{sets:1,reps:8,weight:-100/unit}];
 return normalize(s);
});historyCharts(assistanceFixture)`);
assert.equal(run('ASSISTED.length'),0); // Preserve Emilia's original exercise identity.
for(const point of plain(run('historyPlots.exercise0.points'))){
 assert.ok(Math.abs(point.w-1042)<1e-8); // (64-14)*2*5 + 64*5 + (64+10)*3.
 assert.equal(point.detail,'3×5 · 1×3'); // Invalid nonpositive system load is excluded.
 assert.equal(point.w,run(`assistanceFixture.find(s=>s.date==='${point.date}').summary.byExercise[0].volumeLoadKgReps`));
}
run("historyShow('2026-03-03')");
assert.ok(element('historyReadout-exercise0').innerHTML.includes('3×5 · 1×3'));
assert.deepEqual([...storage],beforeAssistance);
storage.set('workoutSessionsEmiliaCycles',cycleStorage);
run('renderHistory()');
const safeState=storage.get('workoutSessionsEmilia');storage.set('workoutSessionsEmilia','{broken');assert.throws(()=>run('sessions()'));assert.equal(storage.get('workoutSessionsEmilia'),'{broken');storage.set('workoutSessionsEmilia',safeState);
console.log('PASS: migración sin pérdida; métricas/cobertura; Pavel lineal/escalonado; snapshot y avance sin duplicados; comparación con referencia fija; import/export viejo/nuevo; conflictos; cuota y corrupción; pantallas; fuentes offline; Hist 9 métricas + 9 ejercicios, cargas kg/lbs/corporales, ciclos filtrados y carriles, fechas compartidas, cursor y scroll por animation frame.');
