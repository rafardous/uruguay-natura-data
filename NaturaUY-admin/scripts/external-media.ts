import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';

export function allowedMediaUrl(input:string):URL {
  const url=new URL(input);
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||url.hostname==='localhost'||url.hostname.endsWith('.local'))throw new Error('external_url_not_public_https');
  return url;
}
export function publicIPv4(ip:string):boolean {
  if(isIP(ip)!==4)return false;
  const [a,b,c]=ip.split('.').map(Number) as [number,number,number,number];
  return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||(b===88&&c===99)))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
}
/** Pin each TLS connection to a checked IPv4; never forward cookies or credentials. */
export async function downloadPublic(input:string,maxBytes=45*1024*1024,redirects=0):Promise<Buffer> {
  if(redirects>5)throw new Error('too_many_redirects');
  const url=allowedMediaUrl(input);
  const addresses=await lookup(url.hostname,{family:4,all:true});
  if(!addresses.length||addresses.some(v=>!publicIPv4(v.address)))throw new Error('external_destination_not_public');
  const address=addresses[0]!.address;
  const response=await new Promise<{redirect?:string;body?:Buffer}>((resolve,reject)=>{
    const req=request(url,{family:4,lookup:(_host,_options,callback)=>callback(null,address,4),headers:{'User-Agent':'Arapy-editorial/1.4'},timeout:30000},res=>{
      if([301,302,303,307,308].includes(res.statusCode??0)&&res.headers.location){res.resume();resolve({redirect:new URL(res.headers.location,url).href});return;}
      if(res.statusCode!==200){res.resume();reject(new Error(`external_download_${res.statusCode}`));return;}
      if(Number(res.headers['content-length']??0)>maxBytes){res.destroy();reject(new Error('external_file_too_large'));return;}
      const parts:Buffer[]=[];let size=0;
      res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>maxBytes){res.destroy(new Error('external_file_too_large'));return;}parts.push(chunk);});
      res.on('end',()=>resolve({body:Buffer.concat(parts)}));res.on('error',reject);
    });
    req.on('timeout',()=>req.destroy(new Error('external_download_timeout')));req.on('error',reject);req.end();
  });
  return response.redirect?downloadPublic(response.redirect,maxBytes,redirects+1):response.body!;
}
export async function resolveExternalMedia(input:string):Promise<{url:string;license?:string;author?:string}> {
  const url=allowedMediaUrl(input);
  if(url.hostname==='commons.wikimedia.org'&&url.pathname.startsWith('/wiki/File:')){
    const title=decodeURIComponent(url.pathname.slice('/wiki/'.length));
    const api='https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',titles:title,prop:'imageinfo',iiprop:'url|extmetadata'});
    const json=JSON.parse((await downloadPublic(api,2*1024*1024)).toString());
    const page=Object.values(json.query?.pages??{})[0] as any;const photo=page?.imageinfo?.[0];
    if(!photo?.url)throw new Error('wikimedia_file_not_found');
    return {url:photo.url,license:photo.extmetadata?.LicenseShortName?.value,author:String(photo.extmetadata?.Artist?.value??'').replace(/<[^>]*>/g,'')};
  }
  if(['www.inaturalist.org','inaturalist.org'].includes(url.hostname)&&/^\/observations\/\d+\/?$/.test(url.pathname)){
    const id=url.pathname.split('/')[2];
    const json=JSON.parse((await downloadPublic(`https://api.inaturalist.org/v1/observations/${id}`,2*1024*1024)).toString());
    const photo=json.results?.[0]?.photos?.find((v:any)=>v.license_code==='cc0');
    if(!photo)throw new Error('inaturalist_cc0_photo_required');
    return {url:photo.url.replace('/square.','/original.'),license:'CC0',author:photo.attribution};
  }
  if(['xeno-canto.org','www.xeno-canto.org'].includes(url.hostname)&&/^\/\d+\/?$/.test(url.pathname))return {url:`https://xeno-canto.org/${url.pathname.split('/')[1]}/download`};
  return {url:url.href};
}
export function verifyResolvedRights(resolved:{license?:string},media:{license:string;source:string;evidence_path?:string|null}) {
  if(media.license==='permission'&&media.evidence_path)return;
  if(resolved.license&&resolved.license!==media.license&&!(resolved.license==='CC BY 4.0'&&media.license==='CC-BY-4.0'))throw new Error('external_license_mismatch');
  if(media.source.toLowerCase().includes('inaturalist')&&media.license!=='CC0')throw new Error('inaturalist_cc0_required');
}
