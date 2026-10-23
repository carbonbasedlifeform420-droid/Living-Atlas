export type Theme = 'voyager' | 'gardener' | 'stargazer' | 'scholar' | 'arcanist';
export type Entry = { id: string; title: string; body?: string; date?: string; kind?: string; tags?: string[] };
export type Goal = { id: string; title: string; interest?: string; starting?: string; success?: string; why?: string; status?: string; formats?: string[] };
export type Interest = { id: string; name: string; goal?: string };
export type NodeKind = 'interest' | 'goal' | 'entry' | 'skill' | 'place' | 'project' | 'achievement';
export type Evidence = 'explicit' | 'inferred';
export type Relationship = { id: string; from: string; to: string; kind: 'related' | 'supports' | 'practices' | 'occurred_at' | 'contributes_to'; evidence: Evidence; explanation: string; confirmed?: boolean };
export type Place = { id: string; name: string; country?: string; latitude?: number; longitude?: number; relation: 'visited' | 'lived' | 'studied' | 'aspirational'; date?: string; notes?: string; source?: 'user' | 'import' };
export type Achievement = { id: string; title: string; domain: string; category: 'consistency' | 'accumulation' | 'capability' | 'exploration' | 'creation' | 'understanding'; evidenceIds: string[]; earnedAt: string; description?: string };
export type QuestActivity = { id: string; mode: 'watch' | 'listen' | 'read' | 'do' | 'discuss' | 'create'; description: string; targetCount: number; completedCount: number; relatedIds: string[] };
export type Quest = { id: string; title: string; description: string; kind: 'discovery' | 'convergence' | 'practice' | 'campaign' | 'mastery' | 'creation' | 'expedition'; origin: 'generated' | 'user'; status: 'suggested' | 'active' | 'completed' | 'archived'; activities: QuestActivity[]; relatedIds: string[]; rationale: string; themeStory?: Partial<Record<Theme, string>>; createdAt: string };
export type WorldLandmark = { id: string; domain: string; sourceIds: string[]; stage: 'emerging' | 'established' | 'flourishing'; label?: string; createdAt: string };
export type Atlas = { version: string; name: string; theme: Theme; interests: Interest[]; goals: Goal[]; entries: Entry[]; paths: Record<string, unknown>[]; projects: Record<string, unknown>[]; relationships: Relationship[]; places: Place[]; achievements: Achievement[]; quests: Quest[]; landmarks: WorldLandmark[]; originalImport?: unknown; updatedAt?: string };
export const freshAtlas = (): Atlas => ({ version: '3.0-foundation', name: 'My Living Atlas', theme: 'voyager', interests: [], goals: [], entries: [], paths: [], projects: [], relationships: [], places: [], achievements: [], quests: [], landmarks: [] });
const object = (x: unknown): Record<string, unknown> => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {};
const arr = (x: unknown): Record<string, unknown>[] => Array.isArray(x) ? x.filter(v => v && typeof v === 'object' && !Array.isArray(v)) as Record<string, unknown>[] : [];
const str = (x: unknown, fallback = ''): string => typeof x === 'string' ? x : fallback;
const identifier = (x: unknown): string => str(x) || crypto.randomUUID();
const validTheme = (x: unknown): Theme => ['voyager','gardener','stargazer','scholar','arcanist'].includes(str(x)) ? x as Theme : 'voyager';
const oneOf = <T extends string>(x: unknown, allowed: readonly T[], fallback: T): T => allowed.includes(x as T) ? x as T : fallback;
const strings = (x: unknown): string[] => Array.isArray(x) ? x.filter(v => typeof v === 'string') : [];
const optionalNumber = (x: unknown): number | undefined => typeof x === 'number' && Number.isFinite(x) ? x : undefined;
export function importAtlas(raw: unknown): Atlas {
  const d = object(raw);
  if (!Array.isArray(d.goals) && !Array.isArray(d.pursuits) && !Array.isArray(d.interests) && !Array.isArray(d.records) && !Array.isArray(d.entries)) throw new Error('This file does not appear to be a Living Atlas backup.');
  const legacy = object(d.legacy); const legacyAtlas = arr(legacy.atlases).find(x => x.id === legacy.activeAtlasId) || {};
  const pursuits = arr(d.interests).length ? arr(d.interests) : arr(d.pursuits);
  const entries = arr(d.entries).length ? arr(d.entries) : arr(d.records);
  const rawGoals = arr(d.goals).length ? arr(d.goals) : arr(legacyAtlas.goals);
  const rawEntries = entries.length ? entries : arr(legacyAtlas.entries);
  const rawInterests = pursuits.length ? pursuits : arr(legacyAtlas.areas);
  const relationships: Relationship[] = arr(d.relationships).map(x => ({id:identifier(x.id),from:str(x.from),to:str(x.to),kind:oneOf(x.kind,['related','supports','practices','occurred_at','contributes_to'] as const,'related'),evidence:oneOf(x.evidence,['explicit','inferred'] as const,'inferred'),explanation:str(x.explanation),confirmed:x.confirmed===true})).filter(x=>x.from&&x.to);
  const places: Place[] = arr(d.places).map(x=>({id:identifier(x.id),name:str(x.name),country:str(x.country)||undefined,latitude:optionalNumber(x.latitude),longitude:optionalNumber(x.longitude),relation:oneOf(x.relation,['visited','lived','studied','aspirational'] as const,'studied'),date:str(x.date)||undefined,notes:str(x.notes)||undefined,source:oneOf(x.source,['user','import'] as const,'import')})).filter(x=>x.name);
  const achievements: Achievement[] = arr(d.achievements).map(x=>({id:identifier(x.id),title:str(x.title),domain:str(x.domain),category:oneOf(x.category,['consistency','accumulation','capability','exploration','creation','understanding'] as const,'exploration'),evidenceIds:strings(x.evidenceIds),earnedAt:str(x.earnedAt),description:str(x.description)||undefined})).filter(x=>x.title);
  const quests: Quest[] = arr(d.quests).map(x=>({id:identifier(x.id),title:str(x.title),description:str(x.description),kind:oneOf(x.kind,['discovery','convergence','practice','campaign','mastery','creation','expedition'] as const,'discovery'),origin:oneOf(x.origin,['generated','user'] as const,'user'),status:oneOf(x.status,['suggested','active','completed','archived'] as const,'suggested'),activities:arr(x.activities).map(a=>({id:identifier(a.id),mode:oneOf(a.mode,['watch','listen','read','do','discuss','create'] as const,'do'),description:str(a.description),targetCount:Math.max(1,Number(a.targetCount)||1),completedCount:Math.max(0,Number(a.completedCount)||0),relatedIds:strings(a.relatedIds)})),relatedIds:strings(x.relatedIds),rationale:str(x.rationale),themeStory:object(x.themeStory) as Partial<Record<Theme,string>>,createdAt:str(x.createdAt)})).filter(x=>x.title);
  const landmarks: WorldLandmark[] = arr(d.landmarks).map(x=>({id:identifier(x.id),domain:str(x.domain),sourceIds:strings(x.sourceIds),stage:oneOf(x.stage,['emerging','established','flourishing'] as const,'emerging'),label:str(x.label)||undefined,createdAt:str(x.createdAt)})).filter(x=>x.domain);
  return {version:'3.0-foundation',name:str(d.name,str(legacyAtlas.name,'My Living Atlas')),theme:validTheme(d.theme||legacyAtlas.theme),
    interests:rawInterests.map(x=>({id:identifier(x.id),name:str(x.name),goal:str(x.goal,x.notes as string)})),
    goals:rawGoals.map(x=>({id:identifier(x.id),title:str(x.title),interest:str(x.interest),starting:str(x.starting),success:str(x.success),why:str(x.why),status:str(x.status,'Active'),formats:strings(x.formats)})),
    entries:rawEntries.map(x=>({id:identifier(x.id),title:str(x.title),body:str(x.body,str(x.reflection)),date:str(x.date),kind:str(x.kind),tags:strings(x.tags)})),
    paths:arr(d.paths).length?arr(d.paths):arr(d.practicePaths),projects:arr(d.projects),relationships,places,achievements,quests,landmarks,
    // Preserve a legacy import only once; never recursively nest each later save inside itself.
    originalImport:d.originalImport ?? (d.version ? undefined : raw),updatedAt:str(d.updatedAt)||new Date().toISOString()};
}
