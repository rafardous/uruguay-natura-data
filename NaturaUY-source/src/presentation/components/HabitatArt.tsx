import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import type { Habitat } from '../../domain/entities/habitat';
import { habitatThumbMap } from '../../data/assets/habitatThumbMap';

const symbols:Record<string,string>={pastizales:'〰',montes_palmares:'♧',matorrales:'❋',humedales:'≈',aguas_continentales:'≋',costas_mar:'∿',sierras_roquedales:'△',transformados:'⌂'};
export function HabitatArt({habitat,height=130}:{habitat:Habitat;height?:number}) {
  const source=habitat.photo?(habitatThumbMap[habitat.photo.id]??{uri:habitat.photo.thumbnailUrl}):null;
  if(source)return <Image source={source} style={{height,width:'100%'}} contentFit="cover" accessibilityLabel={habitat.photo!.caption} />;
  return <View style={{height,backgroundColor:`${habitat.color}18`,alignItems:'center',justifyContent:'center',overflow:'hidden'}}><View style={{position:'absolute',width:140,height:140,borderRadius:70,backgroundColor:`${habitat.color}15`,right:-20,top:-40}}/><View style={{position:'absolute',width:100,height:100,borderRadius:50,backgroundColor:`${habitat.color}18`,left:-20,bottom:-35}}/><Text accessibilityElementsHidden style={{fontSize:62,color:habitat.color}}>{symbols[habitat.familyCode]??'❋'}</Text><Text style={{fontSize:12,color:habitat.color,marginTop:4}}>Recurso gráfico · foto pendiente</Text></View>;
}
