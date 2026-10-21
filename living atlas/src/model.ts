export type Theme = 'voyager' | 'gardener' | 'stargazer' | 'scholar';
export type Entry = { id: string; title: string; body?: string; date?: string; kind?: string; tags?: string[] };
export type Goal = { id: string; title: string; interest?: string; starting?: string; success?: string; why?: string; status?: string; formats?: string[] };
export type Interest = { id: string; name: string; goal?: string };
export type Atlas = { version: string; name: string; theme: Theme; interests: Interest[]; goals: Goal[]; entries: Entry[]; paths: Record<string, unknown>[]; projects: Record<string, unknown>[]; originalImport?: unknown; updatedAt?: string };
export const freshAtlas = (): Atlas => ({ version: '2.0-alpha', name: 'My Living Atlas', theme: 'voyager', interests: [], goals: [], entries: [], paths: [], projects: [] });
const object = (x: unknown): Record<string, unknown> => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {};
const arr = (x: unknown): Record<string, unknown>[] => Array.isArray(x) ? x.filter(v => v && typeof v === 'object' && !Array.isArray(v)) as Record<string, unknown>[] : [];
const str = (x: unknown, fallback = ''): string => typeof x === 'string' ? x : fallback;
const identifier = (x: unknown): string => str(x) || crypto.randomUUID();
const theme = (x: unknown): Theme => ['voyager','gardener','stargazer','scholar'].includes(str(x)) ? x as Theme : 'voyager';
export function importAtlas(raw: unknown): Atlas {
  const d = object(raw);
  if (!Array.isArray(d.goals) && !Array.isArray(d.pursuits) && !Array.isArray(d.interests) && !Array.isArray(d.records) && !Array.isArray(d.entries)) throw new Error('This file does not appear to be a Living Atlas backup.');
  const pursuits = arr(d.interests).length ? arr(d.interests) : arr(d.pursuits);
  const entries = arr(d.entries).length ? arr(d.entries) : arr(d.records);
  const legacy = object(d.legacy); const legacyAtlas = arr(legacy.atlases).find(x => x.id === legacy.activeAtlasId) || {};
  const rawGoals = arr(d.goals).length ? arr(d.goals) : arr(legacyAtlas.goals);
  const rawEntries = entries.length ? entries : arr(legacyAtlas.entries);
  const rawInterests = pursuits.length ? pursuits : arr(legacyAtlas.areas);
  return {version:'2.0-alpha', name:str(d.name, str(legacyAtlas.name,'My Living Atlas')), theme:theme(d.theme || legacyAtlas.theme),
    interests:rawInterests.map(x=>({id:identifier(x.id),name:str(x.name),goal:str(x.goal,x.notes as string)})),
    goals:rawGoals.map(x=>({id:identifier(x.id),title:str(x.title),interest:str(x.interest),starting:str(x.starting),success:str(x.success),why:str(x.why),status:str(x.status,'Active'),formats:Array.isArray(x.formats)?x.formats.filter(v=>typeof v==='string') as string[]:[]})),
    entries:rawEntries.map(x=>({id:identifier(x.id),title:str(x.title),body:str(x.body,str(x.reflection)),date:str(x.date),kind:str(x.kind),tags:Array.isArray(x.tags)?x.tags.filter(v=>typeof v==='string') as string[]:[]})),
    paths:arr(d.paths).length?arr(d.paths):arr(d.practicePaths),projects:arr(d.projects),originalImport:raw,updatedAt:new Date().toISOString()};
}
