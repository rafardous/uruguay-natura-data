import {birdGuideDisplay} from '../birdGuide';
import type {BirdNaturalHistory} from '../../entities/species';
const bird:BirdNaturalHistory={guide:null,measurements:[],presence:{code:'R',label:'Residente',months:[1,2],note:'Referencia',outsidePeriod:false},diet:['Fr','In'],habitat:['M'],abundanceCode:'BC'};
test('la vista editorial y móvil preservan la prioridad documentada de la guía',()=>{
 expect(birdGuideDisplay(bird,{habitats:['monte_nativo'],diet:['fish']},'rare','migratory')).toEqual({abundance:'Bastante común',habitats:['monte_nativo'],diets:['Frutos','Insectos'],presence:'Residente'});
});
test('al retirar el dato histórico se usan los atributos generales sin inventar información',()=>{
 expect(birdGuideDisplay(undefined,{habitats:[],diet:[]},null,null)).toEqual({abundance:null,habitats:[],diets:[],presence:null});
});
