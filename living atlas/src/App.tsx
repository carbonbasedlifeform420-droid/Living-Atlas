import {useEffect,useRef,useState} from 'react';
import {createClient, type SupabaseClient, type User} from '@supabase/supabase-js';
import {BookOpen, Compass, Flower2, Stars, Upload, Download, Plus, LogOut, Sparkles, ArrowRight, Layers, Save, Flame} from 'lucide-react';
import {freshAtlas,importAtlas,type Atlas,type Theme} from './model';

const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string|undefined;
const cloudEnabled=!!(url && key && !url.includes('YOUR-PROJECT'));
const supabase:SupabaseClient|null=cloudEnabled?createClient(url!,key!):null;
const LOCAL='living-atlas-v2-local';
const pendingKey=(id:string)=>`living-atlas-v2-pending-${id}`;
const themes:Record<Theme,{name:string,tagline:string,explore:string,archive:string,goals:string,paths:string,icon:typeof Compass}>={
 voyager:{name:'The Voyager',tagline:'Chart your next horizon.',explore:'Explore',archive:'Logbook',goals:'Destinations',paths:'Passages',icon:Compass},
 gardener:{name:'The Gardener',tagline:'Every curiosity can take root.',explore:'Grow',archive:'Journal',goals:'Seeds',paths:'Cultivation',icon:Flower2},
 stargazer:{name:'The Stargazer',tagline:'Follow the connections.',explore:'Discover',archive:'Chronicles',goals:'Horizons',paths:'Orbits',icon:Stars},
 scholar:{name:'The Scholar',tagline:'A lifetime of inquiry.',explore:'Study',archive:'Manuscripts',goals:'Inquiries',paths:'Curricula',icon:BookOpen},
 arcanist:{name:'The Arcanist',tagline:'In the company of dragons, your story becomes legend.',explore:'Divination',archive:'Chronicles',goals:'Epic Quests',paths:'Spellcraft',icon:Flame}
};
type Tab='home'|'interests'|'goals'|'archive'|'paths'|'discover'|'projects'|'settings';
type SyncStatus='loading'|'saved'|'pending'|'saving'|'error'|'local';
function readLocal():Atlas {try{const x=localStorage.getItem(LOCAL);return x?importAtlas(JSON.parse(x)):freshAtlas();}catch{return freshAtlas();}}
function App(){
 const [atlas,setAtlas]=useState<Atlas>(readLocal);
 const [tab,setTab]=useState<Tab>('home');
 const [selectedRegion,setSelectedRegion]=useState<string|null>(null);
 const [user,setUser]=useState<User|null>(null);
 const [authReady,setAuthReady]=useState(!cloudEnabled);
 const [dataReady,setDataReady]=useState(!cloudEnabled);
 const [email,setEmail]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [dirty,setDirty]=useState(false);
 const [syncStatus,setSyncStatus]=useState<SyncStatus>(cloudEnabled?'loading':'local');
 const file=useRef<HTMLInputElement>(null);
 const atlasRef=useRef(atlas);
 const revision=useRef(0);
 const savedRevision=useRef(0);
 const saveQueue=useRef<Promise<void>>(Promise.resolve());
 const accountRef=useRef<string|null>(null);
 const theme=themes[atlas.theme];const Icon=theme.icon;
 atlasRef.current=atlas;

 useEffect(()=>{
  if(!supabase)return;
  let active=true;
  void supabase.auth.getUser().then(({data,error})=>{if(!active)return;if(error)setNotice('Authentication check failed: '+error.message);setUser(data.user);setAuthReady(true)});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(active)setUser(session?.user??null)});
  return()=>{active=false;subscription.unsubscribe()};
 },[]);

 useEffect(()=>{
  if(!authReady)return;
  if(!supabase||!user){accountRef.current=null;setDataReady(!supabase);setSyncStatus('local');return;}
  const id=user.id;
  accountRef.current=id;
  let cancelled=false;
  setDataReady(false);setSyncStatus('loading');setBusy(true);
  void (async()=>{
   const {data,error}=await supabase.from('atlases').select('document').eq('owner_id',id).maybeSingle();
   if(cancelled||accountRef.current!==id)return;
   if(error){setNotice('Cloud load failed: '+error.message);setSyncStatus('error');setBusy(false);return;}
   let next:Atlas;
   try{next=data?.document?importAtlas(data.document):freshAtlas();}
   catch{setNotice('Cloud document could not be read. No changes were made.');setSyncStatus('error');setBusy(false);return;}
   let pending=false;
   try{const raw=localStorage.getItem(pendingKey(id));if(raw){next=importAtlas(JSON.parse(raw));pending=true;setNotice('Recovered unsynced edits from this device. They will be uploaded automatically.');}}catch{setNotice('A local recovery copy could not be read. Please export a backup before editing.');setSyncStatus('error');setBusy(false);return;}
   revision.current=0;savedRevision.current=pending?-1:0;
   atlasRef.current=next;setAtlas(next);setDirty(pending);setSyncStatus(pending?'pending':'saved');setDataReady(true);setBusy(false);
  })();
  return()=>{cancelled=true};
 },[user?.id,authReady]);

 // All cloud writes are serialized. An older request cannot finish after a newer one.
 function queueSave(snapshot:Atlas,rev:number,owner:string){
  if(!supabase)return;
  saveQueue.current=saveQueue.current.catch(()=>{}).then(async()=>{
   if(accountRef.current!==owner)return;
   // A newer edit supersedes a save that has not yet started.
   if(rev<revision.current)return;
   setSyncStatus('saving');
   const {error}=await supabase.from('atlases').upsert({owner_id:owner,document:snapshot,updated_at:new Date().toISOString()},{onConflict:'owner_id'});
   if(accountRef.current!==owner)return;
   if(error){setSyncStatus('error');setNotice('Autosave failed: '+error.message+'. Your edits remain on this device.');return;}
   savedRevision.current=rev;
   if(revision.current===rev){
    try{localStorage.removeItem(pendingKey(owner));}catch{}
    setDirty(false);setSyncStatus('saved');
   }else{setSyncStatus('pending');}
  }).catch(e=>{setSyncStatus('error');setNotice('Autosave failed: '+String(e));});
 }

 useEffect(()=>{
  if(!dataReady||!dirty)return;
  if(!supabase||!user){try{localStorage.setItem(LOCAL,JSON.stringify(atlas));setDirty(false);setSyncStatus('local')}catch{setSyncStatus('error');setNotice('Local storage failed. Export a backup now.')}return;}
  const owner=user.id;
  const rev=revision.current;
  const snapshot=atlas;
  try{localStorage.setItem(pendingKey(owner),JSON.stringify(snapshot));}catch{setSyncStatus('error');setNotice('Could not create a local recovery copy. Export a backup now.');return;}
  setSyncStatus('pending');
  const timer=window.setTimeout(()=>queueSave(snapshot,rev,owner),900);
  return()=>window.clearTimeout(timer);
 },[atlas,dirty,dataReady,user?.id]);

 function update(patch:Partial<Atlas>){
  if(!dataReady)return;
  revision.current+=1;
  setAtlas(a=>({...a,...patch,updatedAt:new Date().toISOString()}));
  setDirty(true);setSyncStatus(supabase?'pending':'local');
 }
 function save(){
  if(!dataReady)return;
  if(!supabase||!user){try{localStorage.setItem(LOCAL,JSON.stringify(atlasRef.current));setDirty(false);setNotice('Saved in this browser.');}catch{setNotice('Local save failed. Export a backup.')}return;}
  try{localStorage.setItem(pendingKey(user.id),JSON.stringify(atlasRef.current));}catch{setNotice('Could not create recovery copy. Export a backup.');return;}
  queueSave(atlasRef.current,revision.current,user.id);
 }
 async function login(){if(!supabase)return;setBusy(true);const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}});setBusy(false);setNotice(error?error.message:'Check your email for the sign-in link.');}
 function exportData(){const blob=new Blob([JSON.stringify(atlas,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='living-atlas-2-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)}
 async function upload(f:File){try{const parsed=JSON.parse(await f.text());const next=importAtlas(parsed);if(!window.confirm(`Import “${next.name}” with ${next.goals.length} goals and ${next.entries.length} records? This replaces the current atlas in this session. Export your current backup first.`))return;update(next);setNotice('Imported successfully. Autosave will sync this Atlas.');setTab('home')}catch(e){setNotice(e instanceof Error?e.message:'Could not import backup')}}
 function addGoal(){const title=window.prompt('What would you like to work toward?');if(!title?.trim())return;update({goals:[...atlas.goals,{id:crypto.randomUUID(),title:title.trim(),status:'Active'}]});setTab('goals')}
 function addInterest(){const name=window.prompt('What are you curious about?');if(!name?.trim())return;update({interests:[...atlas.interests,{id:crypto.randomUUID(),name:name.trim()}]});setTab('interests')}
 function capture(){const title=window.prompt('Give this moment a title');if(!title?.trim())return;const body=window.prompt('What happened? (optional)')||'';update({entries:[{id:crypto.randomUUID(),title:title.trim(),body,date:new Date().toISOString().slice(0,10),kind:'moment'},...atlas.entries]});setTab('archive')}
 const questNames:Record<Theme,string>={voyager:'Expedition',gardener:'Cultivation',stargazer:'Mission',scholar:'Inquiry',arcanist:'Quest'};
 const completedQuests=atlas.entries.filter(e=>e.kind==='quest');
 function completeQuest(title:string){
  if(!window.confirm(`Record completion of “${title}”? Only confirm activities you actually completed.`))return;
  update({entries:[{id:crypto.randomUUID(),title:`${questNames[atlas.theme]} complete: ${title}`,body:'Completed a self-directed activity. Add further reflections in a future journal update.',date:new Date().toISOString().slice(0,10),kind:'quest'},...atlas.entries]});
  setNotice('Achievement recorded in your archive. Your world is growing.');
 }
 const regionNames=[...atlas.interests.slice(0,8).map(i=>i.name),...atlas.goals.slice(0,4).map(g=>g.title)].filter((v,i,a)=>a.indexOf(v)===i);
 const regionIcons=['🧭','🎼','🌿','📜','🌌','🗺️','✨','🏝️','📚','🎨','🔭','🌱'];
 const worldLabels:Record<Theme,string>={voyager:'Your living archipelago',gardener:'Your curiosity garden',stargazer:'Your constellation',scholar:'Your living athenaeum',arcanist:'The Dragonbound Realm'};
 const worldBackground:Record<Theme,string>={voyager:'radial-gradient(ellipse at 65% 35%,#256c81 0%,#163b58 38%,#0a1b33 85%)',gardener:'radial-gradient(ellipse at 65% 35%,#547d45 0%,#214934 42%,#112e27 90%)',stargazer:'radial-gradient(ellipse at 65% 35%,#6655a6 0%,#252858 43%,#10162f 90%)',scholar:'radial-gradient(ellipse at 65% 35%,#866348 0%,#483729 43%,#241d20 90%)',arcanist:'radial-gradient(ellipse at 70% 25%,#855e91 0%,#3e315b 36%,#15152f 85%)'};
 const worldCard=(name:string,index:number)=><button key={name} onClick={()=>setSelectedRegion(name)} style={{minHeight:132,display:'flex',flexDirection:'column',alignItems:'flex-start',justifyContent:'space-between',padding:18,border:'1px solid #ffffff55',borderRadius:22,color:'#fff',background:index%3===0?'linear-gradient(145deg,#447e89,#17394f)':index%3===1?'linear-gradient(145deg,#83724c,#44395a)':'linear-gradient(145deg,#526e54,#203e54)',textAlign:'left',boxShadow:'0 12px 25px #0004',cursor:'pointer'}}><span style={{fontSize:34}}>{atlas.theme==='arcanist'?['🐉','🔮','📜','🏰','🪄','🗝️','🧙','✨'][index%8]:regionIcons[index%regionIcons.length]}</span><strong style={{fontSize:17}}>{name}</strong><small>{atlas.theme==='arcanist'?'Enter domain ↗':'Open collection ↗'}</small></button>;
 const navigation:[Tab,string][]=[['home','Home'],['discover',theme.explore],['goals',theme.goals],['paths',theme.paths],['archive',theme.archive],['interests','Interests'],['projects','Shared Worlds'],['settings','Settings']];
 const syncLabel:Record<SyncStatus,string>={loading:'Loading your Atlas…',saved:'✓ All changes saved',pending:'● Unsaved changes · syncing soon',saving:'↻ Saving to cloud…',error:'⚠ Sync issue · local recovery retained',local:'◉ Local browser storage'};
 if(!authReady)return <div className="center">Preparing your atlas…</div>;
 if(cloudEnabled&&!user)return <div className={'app theme-'+atlas.theme}><div className="auth card"><div className="emblem"><Icon size={38}/></div><h1>Living Atlas</h1><p>Your story is still unfolding.</p><h2>Sign in to your personal world</h2><form onSubmit={e=>{e.preventDefault();void login()}}><input type="email" placeholder="Your email" required value={email} onChange={e=>setEmail(e.target.value)}/><button disabled={busy}>Send sign-in link <ArrowRight size={16}/></button></form><small>Private by default. No password required.</small>{notice&&<p className="notice">{notice}</p>}</div></div>;
 if(!dataReady)return <div className="center">{syncStatus==='error'?'Unable to load your Atlas safely. Refresh to retry.': 'Loading your private Atlas…'}{notice&&<p className="notice">{notice}</p>}</div>;
 return <div className={'app theme-'+atlas.theme}>
 <aside className="sidebar"><div className="brand"><div className="emblem"><Icon size={28}/></div><div><strong>Living Atlas</strong><small>{theme.name}</small></div></div><nav>{navigation.map(([id,label])=><button className={tab===id?'selected':''} key={id} onClick={()=>setTab(id)}>{label}</button>)}</nav><div className="sidebar-foot">{syncLabel[syncStatus]}</div></aside>
 <main><header><div className="eyebrow">{theme.name} / {tab==='home'?'Your world':tab}</div><div className="header-right"><span role="status" aria-live="polite" style={{fontSize:12}}>{syncLabel[syncStatus]}</span><button className="ghost" onClick={exportData}><Download size={16}/> Export</button><button onClick={save} disabled={busy||syncStatus==='saving'}><Save size={16}/> Save now</button></div></header>
 {notice&&<div className="notice" role="status" onClick={()=>setNotice('')}>{notice} ×</div>}
 {tab==='home'&&<><section style={{background:worldBackground[atlas.theme],borderRadius:26,padding:'clamp(18px,5vw,38px)',color:'#fff',position:'relative',overflow:'hidden',boxShadow:'0 20px 50px #0004'}}>
 <div style={{fontSize:12,letterSpacing:3,opacity:.75}}>THE LIVING MOSAIC · {theme.name.toUpperCase()}</div>
 <h1 style={{color:'#fff',fontSize:'clamp(29px,6vw,48px)',margin:'12px 0'}}>{worldLabels[atlas.theme]}</h1>
 <p style={{color:'#e0eaf1'}}>{atlas.theme==='arcanist'?'Dragons are revered guardians of wisdom, wonder, and growth. Explore your realm and write your legend.':'Every curiosity is a place to explore. Every experience adds to your story.'}</p>{atlas.theme==='arcanist'&&<div aria-label="Dragon guardian of the realm" style={{fontSize:72,lineHeight:1,margin:'12px 0',filter:'drop-shadow(0 8px 14px #0008)'}}>🐉 <span style={{fontSize:28}}>✨</span></div>}
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:14,marginTop:24}}>{regionNames.map(worldCard)}<button onClick={addInterest} style={{minHeight:132,border:'2px dashed #ffffff77',borderRadius:22,background:'#ffffff13',color:'#fff',fontSize:16}}>＋ Discover a new region</button></div>
 </section>
 {selectedRegion&&<section className="card" style={{marginTop:18,borderRadius:22}}><button className="ghost" onClick={()=>setSelectedRegion(null)}>← Return to world</button><h2>{selectedRegion}</h2><p>Your living collection brings together related memories, goals and experiences.</p><div className="list-cards">{atlas.goals.filter(g=>g.title===selectedRegion||g.interest===selectedRegion).map(g=><article key={g.id} className="card"><small>DESTINATION</small><h3>{g.title}</h3><p>{g.success||'A direction you are exploring.'}</p></article>)}{atlas.entries.filter(e=>(e.title+' '+e.body).toLowerCase().includes(selectedRegion.toLowerCase())).slice(0,8).map(e=><article className="card" key={e.id}><small>{e.date} · SCRAPBOOK</small><h3>{e.title}</h3><p>{e.body}</p></article>)}</div><div className="actions"><button onClick={capture}>＋ Add a memory</button><button className="outline" onClick={()=>setTab('goals')}>View goals</button></div></section>}
 <section style={{margin:'24px 0'}}><div className="section-heading"><div><h2>Available {questNames[atlas.theme]}s</h2><p>Invitations, not obligations. Choose what feels interesting.</p></div><button onClick={()=>setTab('archive')}>Achievements · {completedQuests.length}</button></div><div className="tiles">{atlas.goals.slice(0,3).map((g,i)=><article className="card" key={g.id}><div style={{fontSize:32}}>{regionIcons[(i+2)%regionIcons.length]}</div><small>{questNames[atlas.theme].toUpperCase()} · SELF-DIRECTED</small><h3>{g.title}</h3><p>Take one meaningful step toward this goal. You decide what counts.</p><button onClick={()=>completeQuest(g.title)}>Record completion ✓</button></article>)}{atlas.goals.length===0&&<article className="card"><h3>Your first expedition awaits</h3><p>Add a goal to receive a self-directed quest.</p><button onClick={addGoal}>Add a goal</button></article>}</div></section>
 <section className="hero"><div className="hero-glow"/><div className="hero-content"><span className="overline">YOUR LIVING WORLD</span><h1>{atlas.name}</h1><p>{theme.tagline}</p><div className="actions"><button onClick={capture}><Plus size={16}/> Capture a moment</button><button className="outline" onClick={addInterest}><Plus size={16}/> Add interest</button><button className="outline" onClick={addGoal}><Plus size={16}/> Add goal</button></div></div><div className="hero-art"><Icon size={118} strokeWidth={0.7}/></div></section><div className="stats"><div><strong>{atlas.interests.length}</strong><span>Interests</span></div><div><strong>{atlas.goals.length}</strong><span>Goals</span></div><div><strong>{atlas.entries.length}</strong><span>Moments</span></div><div><strong>{atlas.paths.length}</strong><span>Practice paths</span></div></div><h2>What is unfolding?</h2><div className="tiles"><button className="tile" onClick={()=>setTab('goals')}><Sparkles/><h3>Active directions</h3><p>{atlas.goals.slice(0,2).map(g=>g.title).join(' · ')||'Add a goal to begin a new chapter.'}</p><span>View goals →</span></button><button className="tile" onClick={()=>setTab('archive')}><BookOpen/><h3>Recent memories</h3><p>{atlas.entries.slice(0,2).map(e=>e.title).join(' · ')||'Capture your first moment.'}</p><span>Open archive →</span></button><button className="tile" onClick={()=>setTab('discover')}><Compass/><h3>{theme.explore} something</h3><p>Discovery will connect verified resources to your goals and curiosities.</p><span>Explore foundation →</span></button></div></>}
 {tab==='settings'&&<><h1>Shape your world</h1><p>Choose a foundational theme. Your content stays the same; the world around it changes.</p><div className="theme-grid">{(Object.keys(themes) as Theme[]).map(t=>{const I=themes[t].icon;return <button className={'theme-card preview-'+t+(atlas.theme===t?' active':'')} key={t} onClick={()=>update({theme:t})}><I size={34}/><strong>{themes[t].name}</strong><small>{themes[t].tagline}</small><span>{themes[t].explore} · {themes[t].archive}</span></button>})}</div><div className="card"><h3>Atlas name</h3><input value={atlas.name} onChange={e=>update({name:e.target.value})}/><h3>Backups & migration</h3><p>Import a backup from versions 1.4–1.7, or export your current atlas as JSON. Import replaces the current working document; export first.</p><input ref={file} type="file" accept="application/json,.json" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value=''}}/><div className="actions"><button onClick={()=>file.current?.click()}><Upload size={16}/> Import backup</button><button className="outline" onClick={exportData}><Download size={16}/> Export JSON</button>{user&&<button className="outline" onClick={()=>void supabase?.auth.signOut()}><LogOut size={16}/> Sign out</button>}</div></div></>}
 {tab==='goals'&&<><div className="section-heading"><div><h1>{theme.goals}</h1><p>Directions you're choosing to grow toward.</p></div><button onClick={addGoal}><Plus size={16}/> Add goal</button></div><div className="list-cards">{atlas.goals.map(g=><article className="card" key={g.id}><span className="overline">{g.status||'Active'} {g.interest?'· '+g.interest:''}</span><h3>{g.title}</h3>{g.starting&&<p><b>Starting point:</b> {g.starting}</p>}{g.success&&<p><b>Success looks like:</b> {g.success}</p>}</article>)}{!atlas.goals.length&&<p>No goals yet. Add a direction you care about.</p>}</div></>}
 {tab==='interests'&&<><div className="section-heading"><div><h1>Interests</h1><p>Curiosities that shape your world.</p></div><button onClick={addInterest}><Plus size={16}/> Add interest</button></div><div className="tiles">{atlas.interests.map(i=><article className="card" key={i.id}><h3>{i.name}</h3><p>{i.goal||'A growing curiosity.'}</p></article>)}</div></>}
 {tab==='archive'&&<><div className="section-heading"><div><h1>{theme.archive}</h1><p>Evidence of a life in motion.</p></div><button onClick={capture}><Plus size={16}/> Capture a moment</button></div><div className="card"><h3><Layers size={18}/> Memory Harvest</h3><p>Bulk image upload, metadata extraction, deduplication, and reconstruction are planned for the next milestone. Original photos are not uploaded or stored in this release.</p></div><div className="list-cards">{atlas.entries.map(e=><article className="card" key={e.id}><small>{e.date||'Undated'} · {e.kind||'Moment'}</small><h3>{e.title}</h3><p>{e.body}</p></article>)}</div></>}
 {tab==='discover'&&<><h1>{theme.explore}</h1><p>Specific, verified recommendations and detailed feedback are the next development milestone.</p><div className="card"><h3>Built for relevance, not random assignments</h3><p>Recommendations will have a direct resource, a reason it fits you, a realistic session length, and meaningful feedback. This foundation does not yet generate or verify recommendations.</p><p><b>Your active goals:</b> {atlas.goals.map(g=>g.title).join(' · ')||'Add goals to begin.'}</p></div></>}
 {tab==='paths'&&<><h1>{theme.paths}</h1><p>Repeatable learning routines spanning multiple platforms.</p><div className="card"><h3>Conversations Along the Way</h3><p>Planned reference: AI conversation partner + Duolingo + selected video series, with rotating sessions and editable platform links.</p><p>This release preserves imported path data but does not yet provide the full 1.7 Practice Paths editor.</p></div><div className="list-cards">{atlas.paths.map((p,i)=><article className="card" key={i}><h3>{String(p.title||p.name||'Imported practice path')}</h3><small>Preserved from previous atlas</small></article>)}</div></>}
 {tab==='projects'&&<><h1>Shared Worlds</h1><p>Shared projects require an invitation and permissions model before live collaboration can be enabled.</p><div className="list-cards">{atlas.projects.map((p,i)=><article className="card" key={i}><h3>{String(p.title||'Imported project')}</h3><p>{String(p.description||'')}</p><small>Imported personal copy · not shared live</small></article>)}</div></>}
 <footer>Living Atlas 2.2 · Living Mosaic alpha · {cloudEnabled?'Private cloud mode':'Local preview mode'}</footer></main></div>;
}
export default App;
