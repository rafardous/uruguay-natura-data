import assert from 'node:assert/strict';
import {test} from 'node:test';
import sharp from 'sharp';
import {prepareImageForUpload} from '../src/lib/prepareImage';
import {imageVariants} from './media-image';

test('una foto válida se procesa en servidor cuando el navegador no la decodifica', async()=>{
  const originalDecoder=globalThis.createImageBitmap;
  globalThis.createImageBitmap=async()=>{throw new DOMException('The source image could not be decoded.');};
  try {
    const jpeg=await sharp({create:{width:1800,height:900,channels:3,background:'#456b54'}}).jpeg().toBuffer();
    const file=new File([new Uint8Array(jpeg)],'foto.jpg',{type:'image/jpeg'});
    const prepared=await prepareImageForUpload(file);
    assert.equal(prepared,file);
    const variants=await imageVariants(new Uint8Array(await prepared.arrayBuffer()));
    assert.equal((await sharp(variants.main).metadata()).width,1600);
    assert.equal((await sharp(variants.thumbnail).metadata()).width,480);
    // El fallback no convierte un archivo inválido en un medio aprobado.
    const broken=await prepareImageForUpload(new File(['no es una foto'],'rota.jpg',{type:'image/jpeg'}));
    await assert.rejects(imageVariants(new Uint8Array(await broken.arrayBuffer())));
  } finally {
    globalThis.createImageBitmap=originalDecoder;
  }
});
