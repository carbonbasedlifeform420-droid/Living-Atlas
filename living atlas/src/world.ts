import type { Atlas, Goal, Interest, Quest, Relationship, Theme, WorldLandmark } from './model';

const normalize = (value:string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
const tokens = (value:string) => new Set(normalize(value).split(' ').filter(w=>w.length>3));
const overlap = (a:string,b:string) => [...tokens(a)].filter(w=>tokens(b).has(w));

/** Suggestions are NEVER silently persisted as confirmed user facts. */
export function suggestRelationships(atlas:Atlas): Relationship[] {
  const known = new Set(atlas.relationships.map(r=>[r.from,r.to].sort().join(':')));
  const out: Relationship[]=[];
  for(const goal of atlas.goals){
    for(const interest of atlas.interests){
      const matches = overlap([goal.title,goal.why,goal.interest,goal.success].filter(Boolean).join(' '),[interest.name,interest.goal].filter(Boolean).join(' '));
      const named = normalize(goal.interest||'')===normalize(interest.name) && !!goal.interest;
      if(!named && !matches.length) continue;
      const pair=[goal.id,interest.id].sort().join(':');if(known.has(pair))continue;
      out.push({id:`suggestion:${goal.id}:${interest.id}`,from:goal.id,to:interest.id,kind:'supports',evidence:'inferred',confirmed:false,explanation:named?`Goal explicitly names the interest “${interest.name}”.`:`Shared terms: ${matches.slice(0,3).join(', ')}. Review this connection before accepting.`});
    }
  }
  return out;
}

/** Deterministic starting regions, not arbitrary index-based emoji assignments. */
export function deriveStartingRegions(atlas:Atlas): WorldLandmark[] {
  const existing = new Set(atlas.landmarks.flatMap(l=>l.sourceIds));
  return [...atlas.interests.map((i:Interest)=>({id:i.id,label:i.name})),...atlas.goals.map((g:Goal)=>({id:g.id,label:g.title}))]
    .filter(x=>!existing.has(x.id)).map(x=>({id:`derived:${x.id}`,domain:x.label,sourceIds:[x.id],stage:'emerging' as const,label:x.label,createdAt:atlas.updatedAt||''}));
}

/** A conservative proposal: meaningful connections are required for a convergence quest. */
export function proposeConvergenceQuests(atlas:Atlas): Quest[] {
  const links=[...atlas.relationships.filter(r=>r.confirmed||r.evidence==='explicit'),...suggestRelationships(atlas).filter(r=>r.confirmed)];
  const now=new Date().toISOString();
  return atlas.goals.flatMap(g=>{
    const interestIds=links.filter(r=>r.from===g.id||r.to===g.id).map(r=>r.from===g.id?r.to:r.from).filter(id=>atlas.interests.some(i=>i.id===id));
    if(interestIds.length<2)return [];
    const related=atlas.interests.filter(i=>interestIds.includes(i.id));
    if(atlas.quests.some(q=>q.kind==='convergence'&&q.relatedIds.includes(g.id)))return [];
    return [{id:`proposal:${g.id}`,title:`Explore the crossroads: ${g.title}`,description:`Choose a meaningful activity connecting ${related.slice(0,3).map(i=>i.name).join(', ')} with your goal.`,kind:'convergence' as const,origin:'generated' as const,status:'suggested' as const,activities:[{id:`activity:${g.id}`,mode:'do' as const,description:'Choose and personalize a practical activity',targetCount:1,completedCount:0,relatedIds:[g.id,...interestIds]}],relatedIds:[g.id,...interestIds],rationale:`Connected to ${related.length} confirmed interests. Customize the activity before beginning.`,createdAt:now}];
  });
}

export const realmNames:Record<Theme,(domain:string)=>string>={
 voyager:d=>`The ${d} Isles`,gardener:d=>`The ${d} Grove`,stargazer:d=>`The ${d} Constellation`,scholar:d=>`The ${d} Collection`,arcanist:d=>`The ${d} Sanctuary`
};
