// Test script to verify field formatting
import { getFieldDefinition, applyFieldFormat } from './config/field-dictionary';

// Test 1: Check if nome_cor exists
const fieldDef = getFieldDefinition('nome_cor');
console.log('Field Definition:', fieldDef);

// Test 2: Test formatting
const testValue = 'azul meia-noite';
const format = fieldDef?.format || 'capitalize';
const formatted = applyFieldFormat(testValue, format);
console.log('Input:', testValue);
console.log('Format:', format);
console.log('Output:', formatted);
console.log('Expected:', 'Azul meia-noite');
