import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { habitatRepository } from '../../data/repositories/habitatRepository';
import type { Habitat } from '../../domain/entities/habitat';
import { registerHabitatLabels } from '../../domain/catalogLabels';

type CatalogState={items:Habitat[];aliases:Record<string,string>;error:string;loading:boolean};
const EMPTY:CatalogState={items:[],aliases:{},error:'',loading:false};
const HabitatCatalogContext=createContext<CatalogState>(EMPTY);
/** Un catálogo compartido por SQLite, sin consultas nuevas por cada etiqueta. */
export function HabitatCatalogProvider({children}:{children:ReactNode}) {
  const db=useSQLiteContext();const [state,setState]=useState<CatalogState>({...EMPTY,loading:true});
  useEffect(()=>{let active=true;setState({...EMPTY,loading:true});
    void Promise.all([habitatRepository.list(db),habitatRepository.aliases(db)]).then(([items,aliases])=>{
      if(active){registerHabitatLabels(items);setState({items,aliases,error:'',loading:false});}
    }).catch((error:Error)=>{if(active)setState({...EMPTY,error:error.message});});
    return()=>{active=false;};
  },[db]);
  return createElement(HabitatCatalogContext.Provider,{value:state},children);
}
export function useHabitatCatalog():CatalogState {return useContext(HabitatCatalogContext);}
