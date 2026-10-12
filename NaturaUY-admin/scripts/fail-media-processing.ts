import {adminClient,required} from './shared';
const mediaId=required('MEDIA_ID');
const {error}=await adminClient().from('species_media').update({status:'failed',processing_error:'Falló el procesamiento en GitHub Actions. Revisá el job y reintentá la carga desde la ficha.'}).eq('id',mediaId).in('status',['reserved','processing']);
if(error)throw error;
