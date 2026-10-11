import sharp from 'sharp';

/** Validación y variantes comunes al pipeline de especies y ambientes. */
export async function imageVariants(original: Uint8Array) {
  if(original.length>20*1024*1024)throw new Error('image_too_large');
  const input=sharp(original,{failOn:'error',limitInputPixels:50_000_000});
  const metadata=await input.metadata();
  if(!metadata.format||!['jpeg','png','webp','heif'].includes(metadata.format)||!metadata.width||!metadata.height||metadata.width*metadata.height>50_000_000)throw new Error('image_invalid');
  const main=await input.clone().rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:80,effort:5}).toBuffer();
  const thumbnail=await input.clone().rotate().resize({width:480,height:480,fit:'inside',withoutEnlargement:true}).webp({quality:76,effort:5}).toBuffer();
  return {main,thumbnail};
}
