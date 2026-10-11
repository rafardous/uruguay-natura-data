export interface HabitatSource { name: string; url: string; year: string | null }
export interface Habitat {
  id: string; code: string; name: string; kind: 'group' | 'type' | 'aggregate'; familyCode: string;
  color: string; count: number; gameGroups: string[];
  content: { description: string; recognition?: string; conditions?: string; vegetation?: string; distribution?: string; places?: string[]; importance?: string; threats?: string };
  fieldSources: Record<string, HabitatSource[]>;
  photo: { id:string; url:string; thumbnailUrl:string; author:string; license:string; licenseUrl:string|null; sourceUrl:string; location:string; caption:string } | null;
}
export interface HabitatMetric { id:string; metric:string; value:number; unit:string; referenceYear:number; denominator:string; method:string; source:HabitatSource; note:string }
