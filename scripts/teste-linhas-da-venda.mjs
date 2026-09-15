// Teste de src/lib/linhasDaVenda.ts (7.3.1), sem instalar nada.
//
// Compila o arquivo com o esbuild que já vem com o vite e importa o resultado.
// Uso: node scripts/teste-linhas-da-venda.mjs
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const saida = join(mkdtempSync(join(tmpdir(), 'linhas-da-venda-')), 'linhasDaVenda.mjs')
execFileSync(
  join(raiz, 'node_modules/.bin/esbuild'),
  [
    'src/lib/linhasDaVenda.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--tsconfig=tsconfig.app.json',
    '--log-level=warning',
    `--outfile=${saida}`,
  ],
  { cwd: raiz, stdio: 'inherit' },
)
const { linhasDaParcela, linhasDaVenda, resumoDaParcela } = await import(pathToFileURL(saida).href)

let passou = 0
function caso(nome, fn) {
  fn()
  passou++
  console.log(`ok  ${nome}`)
}
const semFicaDaImobiliaria = (linhas) =>
  assert.equal(
    linhas.some((l) => /imobili/i.test(l.rotulo)),
    false,
    'o corretor nunca pode ver "Fica para a imobiliária"',
  )

// A parcela do print (414-D): 17.020,36 − 510,61 − 990,58 − 10.000,00 = 5.519,17 (valores gravados).
const parcela = (extra = {}) => ({
  id: 'p1', sale_id: 'v1', idx: 1, count: 3, expected_date: '2026-09-02',
  amount: 17020.36, iss_amount: 510.61, simples_amount: 990.58, broker_amount: 10000,
  broker_adjustment: 0, owner_amount: 0, net_amount: 5519.17, status: 'recebida',
  received_date: '2026-09-02', received_amount: 16509.75, account_id: null, notes: null,
  revenue_tx_id: 'tx-rev', iss_tx_id: 'tx-iss', simples_tx_id: 'tx-sim', broker_tx_id: 'tx-cor',
  owner_tx_id: null, other_tx_id: null, ...extra,
})
const vendaInfo = { iss_pct: 3, simples_pct: 6, broker_pct: 65, brokerName: 'Dionata Alves' }
const corretorParcela = {
  id: 'p1', sale_id: 'v1', sale_title: '414-D', development: null, idx: 1, count: 3,
  expected_date: '2026-09-02', received_date: '2026-09-02', installment_amount: 17020.36,
  iss_amount: 510.61, simples_amount: 990.58, broker_pct: 65, broker_amount: 10000,
  broker_adjustment: 250, status: 'liberada', paid_date: null, notes: null,
}
const venda = {
  id: 'v1', iss_pct: 3, simples_pct: 6, broker_pct: 65, owner_profit_pct: null, brokerName: 'Dionata Alves',
  installments: [parcela(), parcela({ id: 'p2', idx: 2 }), parcela({ id: 'p3', idx: 3, status: 'cancelada' })],
  cascade: { commission: 34040.72, iss: 1021.22, simples: 1981.16, broker: 20000, brokerAdjustment: 0, owner: 0, net: 11038.34, netShare: 0.32 },
}

caso('admin: parcela na ordem bruto, −, =, com os campos gravados', () => {
  const l = linhasDaParcela(parcela(), 'admin', { venda: vendaInfo, situacaoCorretor: 'recebida' })
  assert.deepEqual(l.map((x) => x.chave), ['bruto', 'iss', 'simples', 'corretor', 'fica'])
  assert.deepEqual(l.map((x) => x.sinal), ['+', '−', '−', '−', '='])
  assert.deepEqual(l.map((x) => x.valor), [17020.36, 510.61, 990.58, 10000, 5519.17])
  assert.equal(l[4].rotulo, 'Fica para a imobiliária')
  assert.equal(l[4].valor, parcela().net_amount, 'fica é o net_amount gravado, sem conta nova')
  assert.equal(l[3].rotulo, 'Dionata Alves')
  assert.equal(l[3].situacao, 'recebida')
  assert.deepEqual(l[1].origem, { tipo: 'transacao', id: 'tx-iss' })
  assert.equal(l[1].detalhe, '3%')
})

caso('admin: imposto zerado não gera linha', () => {
  const l = linhasDaParcela(parcela({ iss_amount: 0, simples_amount: 0 }), 'admin')
  assert.deepEqual(l.map((x) => x.chave), ['bruto', 'corretor', 'fica'])
})

caso('corretor (SaleInstallment): nunca gera "Fica para a imobiliária"', () => {
  const l = linhasDaParcela(parcela(), 'corretor', { venda: vendaInfo })
  semFicaDaImobiliaria(l)
  assert.equal(l.at(-1).rotulo, 'Fica para você')
  assert.equal(l.some((x) => x.valor === 5519.17), false, 'o líquido da imobiliária não aparece nem como número')
})

caso('corretor (CorretorParcela): a conta dele com desconto combinado', () => {
  const l = linhasDaParcela(corretorParcela, 'corretor', { situacaoCorretor: 'liberada' })
  semFicaDaImobiliaria(l)
  assert.deepEqual(l.map((x) => x.chave), ['bruto', 'iss', 'simples', 'base', 'corretor', 'desconto', 'fica'])
  assert.equal(l.find((x) => x.chave === 'fica').valor, 9750)
  assert.equal(l.find((x) => x.chave === 'fica').situacao, 'liberada')
})

caso('corretor mesmo pedindo admin com CorretorParcela: continua sem a linha da imobiliária', () => {
  semFicaDaImobiliaria(linhasDaParcela(corretorParcela, 'admin'))
})

caso('venda admin: totais de venda.cascade', () => {
  const l = linhasDaVenda(venda, 'admin')
  assert.deepEqual(l.map((x) => x.valor), [34040.72, 1021.22, 1981.16, 20000, 11038.34])
  assert.equal(l[0].detalhe, 'soma das 2 parcelas')
  assert.equal(l.at(-1).rotulo, 'Fica para a imobiliária')
})

caso('venda corretor: nunca gera "Fica para a imobiliária"', () => {
  const l = linhasDaVenda(venda, 'corretor')
  semFicaDaImobiliaria(l)
  assert.equal(l.some((x) => x.valor === 11038.34), false)
  assert.equal(l.at(-1).valor, 20000)
})

caso('resumo admin: impostos, corretor, fica; corretor: sem fica', () => {
  const r = resumoDaParcela(parcela(), 'admin', { venda: vendaInfo })
  assert.equal(r.impostos, 1501.19)
  assert.equal(r.fica, 5519.17)
  assert.deepEqual(r.linhas.map((x) => x.chave), ['impostos', 'corretor', 'fica'])
  const rc = resumoDaParcela(parcela(), 'corretor', { venda: vendaInfo })
  assert.equal(rc.fica, null)
  semFicaDaImobiliaria(rc.linhas)
})

console.log(`\n${passou} casos passaram.`)
