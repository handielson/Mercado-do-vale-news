import React, { useState } from 'react';
import { applyFieldFormat } from '../config/field-dictionary';

export const TestFormatting = () => {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');

    const handleTest = () => {
        const result = applyFieldFormat(input, 'capitalize');
        setOutput(result);
        console.log('Test:', { input, output: result });
    };

    return (
        <div style={{ padding: '20px', border: '2px solid red', margin: '20px' }}>
            <h2>🧪 Test Field Formatting</h2>
            <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite algo..."
                style={{ padding: '10px', width: '300px' }}
            />
            <button onClick={handleTest} style={{ padding: '10px', marginLeft: '10px' }}>
                Test Capitalize
            </button>
            <div style={{ marginTop: '20px' }}>
                <strong>Input:</strong> {input}<br />
                <strong>Output:</strong> {output}
            </div>
        </div>
    );
};
