import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedMediaUrl,publicIPv4,verifyResolvedRights} from './external-media';
test('rechaza URLs privadas, credenciales, puertos y protocolos inseguros',()=>{
 for(const value of ['http://example.com/a','https://localhost/a','https://foo.local/a','https://user:password@example.com/a','https://example.com:8080/a'])assert.throws(()=>allowedMediaUrl(value));
 for(const ip of ['127.0.0.1','10.1.1.1','172.16.0.1','192.168.2.3','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','::1','::ffff:127.0.0.1'])assert.equal(publicIPv4(ip),false,ip);
 assert.equal(publicIPv4('8.8.8.8'),true);
});
test('no cambia la licencia obtenida del proveedor por una declaración incompatible',()=>{
 assert.throws(()=>verifyResolvedRights({license:'CC BY-SA 4.0'},{license:'CC-BY-4.0',source:'Wikimedia'}),/mismatch/);
 assert.throws(()=>verifyResolvedRights({},{license:'CC-BY-4.0',source:'iNaturalist'}),/cc0/);
 verifyResolvedRights({license:'CC BY 4.0'},{license:'CC-BY-4.0',source:'Wikimedia'});
});
