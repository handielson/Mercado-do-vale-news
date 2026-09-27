import test from 'node:test';
import assert from 'node:assert/strict';
import {print3dVariantLabel} from '../utils/print3dVariantLabel.js';
test('shared variant label accepts commercial aliases without exposing private specs',()=>{
 assert.equal(print3dVariantLabel({sku:'P1',specs:{Material:' PETG ',Cor:'Azul',Tamanho:'Grande',Acabamento:'Fosco',cost:900,nas_path:'/private'}}),'PETG · Azul · Grande · Fosco');
 assert.equal(print3dVariantLabel({sku:'P1',specs:{material:{secret:true},color:'',Cor:'Areia',size:15,finish:['private']}}),'Areia · 15');
 assert.equal(print3dVariantLabel({sku:'P1',specs:{cost:900,nas_path:'/private'}}),'P1');
});
