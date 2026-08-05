import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const serverFiles = ['vps_server.js', 'vps_server.cjs']

for (const serverFile of serverFiles) {
  const source = await readFile(new URL(`../${serverFile}`, import.meta.url), 'utf8')
  const routeStart = source.indexOf("fastify.put('/products/:id'")
  const routeEnd = source.indexOf("fastify.delete('/products/:id'", routeStart)

  assert.notEqual(routeStart, -1, `${serverFile}: rota PUT /products/:id não encontrada`)
  assert.notEqual(routeEnd, -1, `${serverFile}: fim da rota PUT /products/:id não encontrado`)

  const route = source.slice(routeStart, routeEnd)

  assert.match(
    route,
    /is_parent=COALESCE\(\?, is_parent, 0\)/,
    `${serverFile}: atualização deve preservar is_parent quando o campo for omitido`,
  )
  assert.match(
    route,
    /optionalBool\(p\.is_parent\)/,
    `${serverFile}: atualização deve continuar aceitando true e false explícitos`,
  )
}

console.log('product update is_parent null regression: ok')
