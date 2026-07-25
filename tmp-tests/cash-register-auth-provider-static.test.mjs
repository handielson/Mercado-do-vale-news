import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = [
    'pages/pdv/PDVPage.tsx',
    'components/pdv/CashOpeningModal.tsx',
];

test('fluxo de caixa usa o provider de autenticacao ativo na aplicacao', async () => {
    for (const file of files) {
        const source = await readFile(file, 'utf8');

        assert.match(source, /(contexts\/VpsAuthContext|hooks\/useVpsAuth)/);
        assert.match(source, /use(?:VpsAuth|Auth)\(\)/);
        assert.doesNotMatch(source, /contexts\/AuthContext/);
    }

    const authHook = await readFile('hooks/useVpsAuth.ts', 'utf8');
    assert.match(authHook, /export \{ useVpsAuth \} from '\.\.\/contexts\/VpsAuthContext'/);

    const app = await readFile('App.tsx', 'utf8');
    assert.match(app, /<VpsAuthProvider>/);
});
