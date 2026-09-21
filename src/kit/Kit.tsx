import { useEffect, useState, type ReactNode } from 'react'
import {
  ArrowDownToLine,
  ArrowLeft,
  Building2,
  CircleDollarSign,
  FileText,
  HandCoins,
  Handshake,
  Inbox,
  ListOrdered,
  Moon,
  MoreHorizontal,
  Plus,
  Receipt,
  Sun,
  TrendingUp,
  Ruler,
  Calculator,
} from 'lucide-react'
import { Lockup } from '@/components/marca/Marca'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { IconeTom } from '@/components/ui/IconeTom'
import { Selo } from '@/components/ui/Selo'
import { Rotulo } from '@/components/ui/Rotulo'
import { Chip } from '@/components/ui/Chip'
import { Badge } from '@/components/ui/Badge'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/Field'
import { CurrencyInput, PercentInput } from '@/components/ui/MoneyInput'
import { Abas, PainelAba } from '@/components/ui/Abas'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { Cartao } from '@/components/ui/Cartao'
import { Lista, Linha, LinhaGrupo } from '@/components/ui/Lista'
import { ParAgoraPrevisto } from '@/components/ui/ParAgoraPrevisto'
import { Parcela, CabecalhoParcelas } from '@/components/ui/Parcela'
import { Demonstrativo } from '@/components/ui/Demonstrativo'
import { Heroi } from '@/components/ui/Heroi'
import { Kpi } from '@/components/ui/Kpi'
import { Tabela, type ColunaTabela } from '@/components/ui/Tabela'
import { EstadoVazio, EstadoErro, EsqueletoLista, EsqueletoCards } from '@/components/ui/Estados'
import { ListaCarregando } from '@/components/ui/Esqueleto'
import { Barra, BarraTrilha, LegendaBarra, LegendaTrilha } from '@/components/ui/Barra'
import { SidePanel } from '@/components/ui/SidePanel'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { Dica } from '@/components/ui/Dica'
import { Tip } from '@/components/ui/Tip'
import type { Tom } from '@/components/ui/tom'
import { linhasDaParcela, resumoDaParcela, type LinhaDemonstrativo } from '@/lib/linhasDaVenda'
import { VOCABULARIO, type Situacao } from '@/lib/situacao'
import { SeletorMes } from '@/admin/SeletorMes'
import type { SaleInstallment } from '@/types'

/*
 * KIT VISUAL (docs/souza-os-fundamentos.md, 10 Fase 6 item 13; 11 item 56).
 *
 * A vitrine dos componentes REAIS, com dados de EXEMPLO: nenhum número, nome
 * de cliente ou de corretor é da Souza Imobiliária. Não há banco: nada grava.
 * Os exemplos só compõem o que os componentes recebem; nenhuma conta nova mora
 * aqui (os resumos de parcela vêm de src/lib/linhasDaVenda.ts).
 *
 * Servido só em desenvolvimento (kit.html não entra no build).
 */

// ---------------------------------------------------------------------------
// Dados de exemplo
// ---------------------------------------------------------------------------

const HOJE = '2026-09-12'

function parcelaExemplo(idx: number, status: SaleInstallment['status'], datas: { prevista: string; recebida?: string }): SaleInstallment {
  const amount = 12000
  const iss = 360
  const simples = 720
  const broker = 6552
  return {
    id: `exemplo-${idx}`,
    sale_id: 'exemplo',
    idx,
    count: 3,
    expected_date: datas.prevista,
    amount,
    iss_amount: iss,
    simples_amount: simples,
    broker_amount: broker,
    broker_adjustment: 0,
    owner_amount: 0,
    trigger_note: null,
    trigger_met_date: status === 'prevista' && idx === 2 ? '2026-09-04' : null,
    invoice_issued_date: status === 'prevista' && idx === 2 ? '2026-09-08' : null,
    invoice_number: null,
    net_amount: amount - iss - simples - broker,
    status,
    received_date: datas.recebida ?? null,
    received_amount: datas.recebida ? amount - iss : null,
    account_id: null,
    notes: null,
    revenue_tx_id: null,
    iss_tx_id: null,
    simples_tx_id: null,
    broker_tx_id: null,
    owner_tx_id: null,
    other_tx_id: null,
  }
}

const VENDA_EXEMPLO = { iss_pct: 3, simples_pct: 6, broker_pct: 60, brokerName: 'Corretor Exemplo' }

const PARCELAS: { p: SaleInstallment; situacao: Situacao; corretor: Situacao }[] = [
  { p: parcelaExemplo(1, 'recebida', { prevista: '2026-09-02', recebida: '2026-09-02' }), situacao: 'recebida', corretor: 'recebida' },
  { p: parcelaExemplo(2, 'prevista', { prevista: '2026-10-10' }), situacao: 'prevista', corretor: 'prevista' },
  { p: parcelaExemplo(3, 'prevista', { prevista: '2026-11-10' }), situacao: 'prevista', corretor: 'prevista' },
]

const resumo = (i: number, perfil: 'admin' | 'corretor' = 'admin') =>
  resumoDaParcela(PARCELAS[i].p, perfil, { venda: VENDA_EXEMPLO, situacaoCorretor: PARCELAS[i].corretor })

/* A conta da venda inteira, escrita com os mesmos campos das três parcelas de exemplo. */
const CONTA_DA_VENDA: LinhaDemonstrativo[] = [
  { chave: 'bruto', rotulo: 'Comissão contratada', sinal: '+', valor: 36000 },
  { chave: 'iss', rotulo: 'ISS retido', detalhe: '3%', sinal: '−', valor: 1080 },
  { chave: 'simples', rotulo: 'Simples', detalhe: '6%', sinal: '−', valor: 2160 },
  { chave: 'corretor', rotulo: 'Corretor Exemplo', detalhe: '60% da base', sinal: '−', valor: 19656 },
  { chave: 'fica', rotulo: 'Fica, se tudo for pago', sinal: '=', valor: 13104 },
]

const SITUACOES: Situacao[] = ['prevista', 'liberada', 'vencida', 'recebida', 'cancelada']
const TONS: Tom[] = ['marca', 'sucesso', 'atencao', 'risco', 'info', 'neutro']

// ---------------------------------------------------------------------------
// Moldura do kit
// ---------------------------------------------------------------------------

const GRUPOS = [
  ['espaco', 'Espaço'],
  ['tipo', 'Tipo'],
  ['valor', 'Valor'],
  ['situacao', 'Situação'],
  ['botoes', 'Botões'],
  ['campos', 'Campos'],
  ['controles', 'Controles'],
  ['listas', 'Cartão e lista'],
  ['parcela', 'Parcela'],
  ['demonstrativo', 'Demonstrativo'],
  ['heroi', 'Herói'],
  ['kpi', 'KPI'],
  ['tabela', 'Tabela'],
  ['estados', 'Estados'],
  ['barra', 'Barra'],
  ['sobreposicoes', 'Sobreposições'],
  ['planta-venda', 'Planta da Venda'],
  ['planta-receber', 'Planta de Receber'],
] as const

type IdGrupo = (typeof GRUPOS)[number][0]

/** Marca discreta de dado fictício. */
function Exemplo() {
  return <span className="text-nota text-t-meta">exemplo</span>
}

function Grupo({ id, descricao, children }: { id: IdGrupo; descricao: ReactNode; children: ReactNode }) {
  const titulo = GRUPOS.find((g) => g[0] === id)?.[1]
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="flex flex-col gap-bloco border-t border-fio-linha pt-8">
      <header className="flex flex-col gap-2">
        <h2 id={`${id}-titulo`} className="font-heading text-titulo-pagina text-t1">
          {titulo}
        </h2>
        <p className="max-w-[62ch] text-texto-corrido text-t3">{descricao}</p>
      </header>
      {children}
    </section>
  )
}

/** Uma amostra dentro do grupo: rótulo em cima, conteúdo 12 abaixo. */
function Amostra({ rotulo, children, className }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-3 ${className ?? ''}`}>
      <Rotulo as="h3">{rotulo}</Rotulo>
      {children}
    </div>
  )
}

/* Tema: html.light é o claro; sem a classe, escuro (docs/souza-os.md, 3). */
function useTema() {
  const [claro, setClaro] = useState(() => document.documentElement.classList.contains('light'))
  const trocar = (paraClaro: boolean) => {
    const html = document.documentElement
    html.classList.add('trocando-tema')
    html.classList.toggle('light', paraClaro)
    try {
      localStorage.setItem('sgf.theme', paraClaro ? 'light' : 'dark')
    } catch {
      /* sem armazenamento: só esta visita */
    }
    requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove('trocando-tema')))
    setClaro(paraClaro)
  }
  return [claro, trocar] as const
}

/* O SeletorMes real, controlado por estado local: no kit não há AdminData. */
function SeletorMesExemplo() {
  const [mes, setMes] = useState(() => new Date(2026, 8, 1))
  const mudar = (passo: number) => setMes((m) => new Date(m.getFullYear(), m.getMonth() + passo, 1))
  return (
    <SeletorMes
      mes={mes}
      aoAnterior={() => mudar(-1)}
      aoSeguinte={() => mudar(1)}
      aoAtual={() => setMes(new Date(2026, 8, 1))}
    />
  )
}

// ---------------------------------------------------------------------------
// Réguas: espaço e tipo
// ---------------------------------------------------------------------------

const ESCALA: [string, number][] = [
  ['w-1', 4], ['w-2', 8], ['w-3', 12], ['w-4', 16], ['w-5', 20], ['w-6', 24],
  ['w-8', 32], ['w-10', 40], ['w-12', 48], ['w-16', 64],
]

const TOKENS_ESPACO: [string, string][] = [
  ['--recuo', '16 · 20 · 24'],
  ['--margem-pagina', '16 · 24 · 32 · 40'],
  ['--vao-bloco', '16 · 24'],
  ['--vao-secao', '24 · 32'],
  ['--topo-conteudo', '24 · 32'],
  ['--linha-min', '56 · 52 · 44 compacta'],
  ['--goteira', '28'],
  ['--col-valor', '9rem'],
]

const TIPOS: [string, string, string][] = [
  ['text-numero-heroi', '34/40 · 800', 'R$ 13.104,00'],
  ['text-numero-kpi', '28/32 · 700', 'R$ 4.368,00'],
  ['text-titulo-pagina', '19/28 · 700', 'Venda T-1204 · Torre Maré'],
  ['text-titulo-painel', '16/24 · 600', 'Receber parcela'],
  ['text-titulo-secao', '15/24 · 600', 'Parcelas'],
  ['text-valor-destaque', '17/24 · 600', 'R$ 36.000,00'],
  ['text-valor-linha', '15/20 · 600', 'R$ 12.000,00'],
  ['text-valor-fato', '14/20 · 500', 'R$ 360,00'],
  ['text-texto-titulo', '14/20 · 500', 'Parcela 2 de 3'],
  ['text-texto', '14/20 · 400', 'Comissão contratada com a construtora'],
  ['text-texto-corrido', '14/22 · 400', 'Depende de a construtora pagar; não é dinheiro em conta.'],
  ['text-texto-meta', '13/20 · 400', 'prevista para 10/10 · Torre Maré'],
  ['text-nota', '12/16 · 400', 'valores de exemplo'],
  ['text-rotulo', '11/16 · 500 · caixa alta', 'Já ficou para a imobiliária'],
  ['text-chip', '11/16 · 600', 'Prevista'],
]

function GrupoEspaco() {
  return (
    <Grupo id="espaco" descricao="Grade de 4px. Padding, margem e gap só nestes degraus ou num token semântico; nada de meio-degrau.">
      <div className="grid gap-bloco lg:grid-cols-2">
        <Cartao rotuloAcessivel="Escala de espaço">
          <Cartao.Cabecalho titulo="Escala" icone={Ruler} meta="classe → px" />
          <Cartao.Corpo>
            {ESCALA.map(([classe, px]) => (
              <div key={classe} className="grid grid-cols-[4rem_3rem_minmax(0,1fr)] items-center gap-4">
                <code className="text-texto-meta text-t3">{classe.replace('w-', '')}</code>
                <span className="num text-texto-meta text-t2 text-right">{px}</span>
                <span className={`${classe} block h-3 rounded-badge bg-t3`} aria-hidden />
              </div>
            ))}
          </Cartao.Corpo>
        </Cartao>
        <Cartao rotuloAcessivel="Tokens de espaço">
          <Cartao.Cabecalho titulo="Tokens semânticos" icone={Ruler} meta="<640 · 640 · 1024 · 1536" />
          <Cartao.Corpo>
            {TOKENS_ESPACO.map(([token, valores]) => (
              <div key={token} className="flex items-baseline justify-between gap-4 border-t border-fio-linha pt-3 first:border-t-0 first:pt-0">
                <code className="text-texto-meta text-t2">{token}</code>
                <span className="num text-texto-meta text-t3">{valores}</span>
              </div>
            ))}
          </Cartao.Corpo>
        </Cartao>
      </div>
    </Grupo>
  )
}

function GrupoTipo() {
  return (
    <Grupo id="tipo" descricao="Um nome por papel. Números em Sora com algarismos tabulares; texto em Inter.">
      <Cartao rotuloAcessivel="Escala de tipo">
        <Cartao.Corpo className="pt-recuo">
          {TIPOS.map(([classe, medida, amostra]) => (
            <div key={classe} className="grid items-baseline gap-2 border-t border-fio-linha pt-3 first:border-t-0 first:pt-0 md:grid-cols-[14rem_10rem_minmax(0,1fr)] md:gap-4">
              <code className="text-texto-meta text-t2">{classe.replace('text-', '')}</code>
              <span className="num text-texto-meta text-t-meta">{medida}</span>
              <span
                className={`${classe} min-w-0 truncate text-t1 ${classe.includes('numero') || classe.includes('valor') ? 'font-heading num' : ''} ${classe === 'text-rotulo' ? 'font-label uppercase' : ''}`}
              >
                {amostra}
              </span>
            </div>
          ))}
        </Cartao.Corpo>
      </Cartao>
    </Grupo>
  )
}

// ---------------------------------------------------------------------------
// Valor, situação
// ---------------------------------------------------------------------------

type Abrir = (titulo: string) => void

/* Exemplo sem banco: toda linha ganha uma origem fictícia para mostrar o drill-down. */
function comOrigem(linhas: LinhaDemonstrativo[]): LinhaDemonstrativo[] {
  return linhas.map((l) => (l.origem ? l : { ...l, origem: { tipo: 'venda', id: 'T-1204' } }))
}

function Posto({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div data-amostra className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-fio-linha py-3 first:border-t-0">
      <span className="text-texto-meta text-t3">{nome}</span>
      {children}
    </div>
  )
}

function GrupoValor({ abrir }: { abrir: Abrir }) {
  return (
    <Grupo id="valor" descricao="Valor é a única forma de desenhar dinheiro: nunca abreviado, com centavos, sinal de menos real e algarismos tabulares.">
      <div className="grid gap-bloco lg:grid-cols-2">
        <Cartao rotuloAcessivel="Valor por posto">
          <Cartao.Cabecalho titulo="Postos" icone={CircleDollarSign} meta={<Exemplo />} />
          <Cartao.Corpo className="gap-0">
            <Posto nome="herói · ouro">
              <Valor posto="heroi" variante="ouro" valor={13104} />
            </Posto>
            <Posto nome="herói · previsto">
              <Valor posto="heroi" variante="previsto" valor={24000} />
            </Posto>
            <Posto nome="kpi">
              <Valor posto="kpi" valor={4368} />
            </Posto>
            <Posto nome="destaque">
              <Valor posto="destaque" valor={36000} />
            </Posto>
            <Posto nome="linha">
              <Valor posto="linha" valor={12000} />
            </Posto>
            <Posto nome="fato">
              <Valor posto="fato" valor={360} />
            </Posto>
          </Cartao.Corpo>
        </Cartao>
        <Cartao rotuloAcessivel="Valor por estado">
          <Cartao.Cabecalho titulo="Estados" icone={CircleDollarSign} meta={<Exemplo />} />
          <Cartao.Corpo className="gap-0">
            <Posto nome="negativo real">
              <Valor posto="linha" estado="negativo" valor={-8381.94} />
            </Posto>
            <Posto nome="herói negativo">
              <Valor posto="heroi" variante="ouro" estado="negativo" valor={-1250.5} />
            </Posto>
            <Posto nome="previsto">
              <Valor posto="linha" previsto valor={6552} />
            </Posto>
            <Posto nome="recebido">
              <Valor posto="linha" estado="recebido" valor={11640} />
            </Posto>
            <Posto nome="vencido">
              <Valor posto="linha" estado="vencido" valor={6552} />
            </Posto>
            <Posto nome="zero">
              <Valor posto="linha" valor={0} />
            </Posto>
            <Posto nome="abre o que compõe">
              <ValorComOrigem posto="destaque" valor={36000} aoAbrir={() => abrir('Comissão contratada')} rotuloAcessivel="Abrir a comissão contratada" />
            </Posto>
          </Cartao.Corpo>
        </Cartao>
      </div>
    </Grupo>
  )
}

function GrupoSituacao() {
  return (
    <Grupo id="situacao" descricao="As palavras vêm de src/lib/situacao.ts; o chip nunca inventa uma. Cor é o quarto sinal: ícone, palavra e frase carregam o estado sozinhos.">
      <Cartao rotuloAcessivel="Situações">
        <Cartao.Lista
          colunas={{ goteira: true, situacao: true, valor: '9rem' }}
          cabecalho={['', 'Situação', 'Admin', 'Corretor']}
          rotuloAcessivel="Chips por situação"
        >
          {SITUACOES.map((s, i) => (
            <Linha
              key={s}
              goteira={<Selo situacao={s} idx={i + 1} count={5} />}
              titulo={VOCABULARIO[s].palavra}
              meta={<FraseDeTempo situacao={s} prevista="2026-10-10" liberada="2026-09-02" recebida="2026-09-02" />}
              situacao={<ChipSituacao situacao={s} perfil="admin" />}
              valor={<ChipSituacao situacao={s} perfil="corretor" />}
            />
          ))}
        </Cartao.Lista>
      </Cartao>
      <div className="grid gap-bloco md:grid-cols-2">
        <Amostra rotulo="Chip por tom">
          <div className="flex flex-wrap gap-2">
            {TONS.map((t) => (
              <Chip key={t} tom={t} icone={CircleDollarSign}>
                {t}
              </Chip>
            ))}
          </div>
        </Amostra>
        <Amostra rotulo="Badge · Selo · IconeTom">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>3</Badge>
            <Badge risco>2</Badge>
            <Badge zero>0</Badge>
            <Selo situacao="recebida" idx={1} count={3} />
            <Selo situacao="prevista" idx={2} count={3} />
            <IconeTom icone={Receipt} tamanho="sm" />
            <IconeTom icone={HandCoins} tom="atencao" />
            <IconeTom icone={Building2} tom="info" tamanho="lg" />
          </div>
        </Amostra>
      </div>
    </Grupo>
  )
}

// ---------------------------------------------------------------------------
// Botões, campos, controles
// ---------------------------------------------------------------------------

function GrupoBotoes() {
  const [carregando, setCarregando] = useState(false)
  const simular = () => {
    setCarregando(true)
    window.setTimeout(() => setCarregando(false), 1600)
  }
  const variantes = ['primario', 'secundario', 'fantasma', 'perigo'] as const
  return (
    <Grupo id="botoes" descricao="Um primário por camada. Perigo nunca é vermelho cheio. Use Tab para ver o foco: 2px em ouro, afastado 2px.">
      <Cartao rotuloAcessivel="Botões">
        <Cartao.Corpo>
          {variantes.map((v) => (
            <div key={v} data-amostra className="flex flex-wrap items-center gap-3 border-t border-fio-linha pt-4 first:border-t-0 first:pt-0">
              <span className="w-24 text-texto-meta text-t3">{v}</span>
              <Button variant={v} size="sm">Pequeno</Button>
              <Button variant={v}>Médio</Button>
              <Button variant={v} size="lg" icone={Plus}>Grande</Button>
              <Button variant={v} disabled>Desabilitado</Button>
              <Button variant={v} size="icone" aria-label="Mais ações" icone={MoreHorizontal} />
            </div>
          ))}
          <div data-amostra className="flex flex-wrap items-center gap-3 border-t border-fio-linha pt-4">
            <span className="w-24 text-texto-meta text-t3">carregando</span>
            <Button carregando={carregando} onClick={simular} icone={HandCoins}>
              Registrar recebimento
            </Button>
            <Button variant="secundario" carregando>
              Salvando
            </Button>
          </div>
        </Cartao.Corpo>
      </Cartao>
    </Grupo>
  )
}

function GrupoCampos() {
  const [valor, setValor] = useState<number | null>(12000)
  const [pct, setPct] = useState<number | null>(3)
  return (
    <Grupo id="campos" descricao="Campo de 44px, borda com 3:1 de contraste; o erro toma o lugar da dica, no mesmo lugar.">
      <Cartao rotuloAcessivel="Campos">
        <Cartao.Corpo>
          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Empreendimento" htmlFor="kit-emp" hint="Como aparece no contrato" required>
              <Input id="kit-emp" defaultValue="Torre Maré (exemplo)" />
            </FormField>
            <FormField label="Valor da parcela" htmlFor="kit-valor">
              <CurrencyInput id="kit-valor" value={valor} onChange={setValor} />
            </FormField>
            <FormField label="ISS retido" htmlFor="kit-iss" hint="Percentual sobre cada recebimento">
              <PercentInput id="kit-iss" value={pct} onChange={setPct} />
            </FormField>
            <FormField label="Data prevista" htmlFor="kit-data" error="A data não pode ficar em branco" required>
              <Input id="kit-data" type="date" aria-invalid />
            </FormField>
            <FormField label="Corretor" htmlFor="kit-corretor">
              <Select id="kit-corretor" defaultValue="1">
                <option value="1">Corretor Exemplo</option>
                <option value="2">Corretora Exemplo</option>
              </Select>
            </FormField>
            <FormField label="Conta" htmlFor="kit-conta" hint="Desabilitado: definida pela venda">
              <Input id="kit-conta" defaultValue="Conta da imobiliária" disabled />
            </FormField>
            <FormField label="Observação" htmlFor="kit-obs" className="md:col-span-2">
              <Textarea id="kit-obs" rows={3} placeholder="Ex.: desconto combinado com o corretor" />
            </FormField>
          </div>
        </Cartao.Corpo>
      </Cartao>
    </Grupo>
  )
}

function GrupoControles() {
  const [aba, setAba] = useState<'parcelas' | 'historico' | 'conta'>('parcelas')
  const [filtro, setFiltro] = useState<'mes' | 'trinta' | 'tudo'>('mes')
  return (
    <Grupo id="controles" descricao="Aba, filtro e mês são neutros: o ativo se diz com peso e fio, nunca com ouro.">
      <div className="flex flex-col gap-bloco">
        <Amostra rotulo="Faixa: SeletorMes + FiltrosRapidos">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <SeletorMesExemplo />
            <FiltrosRapidos
              rotuloAcessivel="Período das listas"
              ativo={filtro}
              aoMudar={setFiltro}
              filtros={[
                { id: 'mes', rotulo: 'Este mês', contador: 3 },
                { id: 'trinta', rotulo: '30 dias', contador: 7 },
                { id: 'tudo', rotulo: 'Tudo', contador: 21 },
              ]}
            />
          </div>
        </Amostra>
        <Amostra rotulo="Abas">
          <Cartao rotuloAcessivel="Abas">
            <Cartao.Corpo className="gap-6">
              <Abas
                idBase="kit-abas"
                rotuloAcessivel="Seções da venda"
                ativa={aba}
                aoMudar={setAba}
                abas={[
                  { id: 'parcelas', rotulo: 'Parcelas', icone: ListOrdered, contador: 3 },
                  { id: 'historico', rotulo: 'Histórico', icone: FileText },
                  { id: 'conta', rotulo: 'Conta', icone: Receipt, contador: 1, tomContador: 'risco' },
                ]}
              />
              <PainelAba idBase="kit-abas" aba={aba}>
                <p className="text-texto-corrido text-t2">
                  Conteúdo da aba “{aba}”. <Exemplo />
                </p>
              </PainelAba>
            </Cartao.Corpo>
          </Cartao>
        </Amostra>
      </div>
    </Grupo>
  )
}

// ---------------------------------------------------------------------------
// Cartão e lista, Parcela, Demonstrativo
// ---------------------------------------------------------------------------

function GrupoListas({ abrir }: { abrir: Abrir }) {
  const par = (
    <ParAgoraPrevisto
      agora={{ valor: 11640, aoAbrir: () => abrir('Já entrou em setembro'), rotuloAcessivel: 'Abrir o que já entrou em setembro' }}
      previsto={{ valor: 24000, aoAbrir: () => abrir('Previsto em setembro'), rotuloAcessivel: 'Abrir o previsto de setembro' }}
    />
  )
  return (
    <Grupo id="listas" descricao="O recuo pertence à caixa: a Lista dá o recuo às linhas e declara as colunas uma vez. Valores pousam na mesma borda direita.">
      <Cartao rotuloAcessivel="Lista com goteira">
        <Cartao.Cabecalho titulo="Parcelas a receber" icone={ListOrdered} meta={<>3 parcelas · <Exemplo /></>} />
        <Cartao.Lista
          colunas={{ goteira: true, situacao: true, valor: true, acao: '7rem', fim: true }}
          cabecalho={['', 'Parcela', 'Situação', 'Valor', '', '']}
          rotuloAcessivel="Parcelas com goteira"
        >
          <LinhaGrupo rotulo="Setembro de 2026" contador="2 parcelas" par={par} />
          <Linha
            goteira={<Selo situacao="recebida" idx={1} count={3} />}
            titulo="T-1204 · parcela 1 de 3"
            meta="recebida em 02/09 · Torre Maré"
            situacao={<ChipSituacao situacao="recebida" />}
            valor={<Valor posto="linha" valor={12000} />}
            aoClicar={() => abrir('T-1204 · parcela 1 de 3')}
          />
          <LinhaGrupo rotulo="Hoje · 12/09" hoje />
          <Linha
            goteira={<Selo situacao="prevista" idx={2} count={3} />}
            titulo="T-1204 · parcela 2 de 3"
            meta="prevista para 10/10 · Torre Maré"
            situacao={<ChipSituacao situacao="prevista" />}
            valor={<Valor posto="linha" previsto valor={12000} />}
            aoClicar={() => abrir('T-1204 · parcela 2 de 3')}
          />
        </Cartao.Lista>
      </Cartao>
      <Cartao rotuloAcessivel="Lista sem goteira, com ação">
        <Cartao.Cabecalho titulo="Comissões a pagar" icone={HandCoins} meta={<Exemplo />} />
        <Cartao.Lista colunas={{ situacao: true, valor: true, acao: '7rem', fim: true }} rotuloAcessivel="Comissões com ação visível">
          <Linha
            titulo="Corretor Exemplo · T-1204"
            meta="liberada em 02/09 · parcela 1 de 3"
            situacao={<ChipSituacao situacao="liberada" />}
            valor={<Valor posto="linha" valor={6552} />}
            acao={<Button size="sm" variant="secundario" onClick={() => abrir('Pagar comissão')}>Pagar</Button>}
            aoClicar={() => abrir('Corretor Exemplo · T-1204')}
          />
          <Linha
            titulo="Corretora Exemplo · A-802"
            meta="liberada em 29/08 · 14 dias esperando"
            situacao={<ChipSituacao situacao="vencida" />}
            valor={<Valor posto="linha" estado="vencido" valor={2480.5} />}
            acao={<Button size="sm" variant="secundario" onClick={() => abrir('Pagar comissão')}>Pagar</Button>}
            aoClicar={() => abrir('Corretora Exemplo · A-802')}
          />
        </Cartao.Lista>
        <Cartao.Rodape>
          <span>2 comissões liberadas</span>
          <ValorComOrigem posto="fato" valor={9032.5} aoAbrir={() => abrir('Comissões liberadas')} rotuloAcessivel="Ver as 2 comissões liberadas" />
        </Cartao.Rodape>
      </Cartao>
    </Grupo>
  )
}

/** Parcelas de exemplo, prontas para qualquer lista. */
function ParcelasExemplo({ abrir, perfil = 'admin' }: { abrir: Abrir; perfil?: 'admin' | 'corretor' }) {
  return (
    <>
      <CabecalhoParcelas perfil={perfil} />
      <Parcela
        perfil={perfil}
        idx={1}
        count={3}
        situacao="recebida"
        meta="recebida em 02/09 · caíram R$ 11.640,00"
        resumo={resumo(0, perfil)}
        menu={<Button size="icone" variant="fantasma" aria-label="Mais ações da parcela 1" icone={MoreHorizontal} />}
        aoAbrir={() => abrir('Parcela 1 de 3')}
      />
      <LinhaGrupo rotulo={`Hoje · ${HOJE.slice(8, 10)}/${HOJE.slice(5, 7)}`} hoje />
      <Parcela
        perfil={perfil}
        idx={2}
        count={3}
        situacao="prevista"
        meta="prevista para 10/10 · em 28 dias"
        resumo={resumo(1, perfil)}
        acao={perfil === 'admin' ? <Button size="sm" variant="secundario" onClick={() => abrir('Receber parcela 2')}>Recebi</Button> : undefined}
        menu={<Button size="icone" variant="fantasma" aria-label="Mais ações da parcela 2" icone={MoreHorizontal} />}
        aoAbrir={() => abrir('Parcela 2 de 3')}
      />
      <Parcela
        perfil={perfil}
        idx={3}
        count={3}
        situacao="prevista"
        meta="prevista para 10/11 · em 59 dias"
        resumo={resumo(2, perfil)}
        aoAbrir={() => abrir('Parcela 3 de 3')}
      />
    </>
  )
}

function GrupoParcela({ abrir }: { abrir: Abrir }) {
  const larguras: [string, string][] = [
    ['w-[1100px]', 'Forma A · 1100px (≥ 65rem)'],
    ['w-[800px]', 'Forma B · 800px (30–65rem)'],
    ['w-[360px]', 'Forma C · 360px (< 30rem)'],
  ]
  return (
    <Grupo id="parcela" descricao="A mesma Parcela nas três formas, disparadas pela largura do cartão (container query), não da tela. Role para o lado.">
      <div data-rolagem className="flex items-start gap-6 overflow-x-auto pb-4">
        {larguras.map(([w, rotulo]) => (
          <Amostra key={w} rotulo={rotulo} className={`${w} shrink-0`}>
            <Cartao rotuloAcessivel={rotulo}>
              <Cartao.Cabecalho titulo="Parcelas" icone={ListOrdered} meta="3 parcelas · 1 recebida" />
              <Cartao.Lista rotuloAcessivel={`Parcelas, ${rotulo}`} className={LISTA_PARCELAS}>
                {ParcelasExemplo({ abrir })}
              </Cartao.Lista>
            </Cartao>
          </Amostra>
        ))}
      </div>
    </Grupo>
  )
}

function GrupoDemonstrativo({ abrir }: { abrir: Abrir }) {
  return (
    <Grupo id="demonstrativo" descricao="Toda conta de cima para baixo: bruto, menos, igual. O sinal fica colado ao valor e a seta que abre a origem tem coluna própria; cada total tem fio acima. O corretor nunca vê o que fica para a imobiliária.">
      <div className="grid gap-bloco lg:grid-cols-2">
        <Cartao rotuloAcessivel="Demonstrativo do admin">
          <Cartao.Cabecalho titulo="Parcela 1 de 3 · admin" icone={Calculator} meta={<Exemplo />} />
          <Cartao.Corpo>
            <Demonstrativo
              perfil="admin"
              tudoEntrou
              linhas={comOrigem(linhasDaParcela(PARCELAS[0].p, 'admin', { venda: VENDA_EXEMPLO, situacaoCorretor: 'recebida' }))}
              aoAbrirOrigem={(l) => abrir(l.rotulo)}
            />
          </Cartao.Corpo>
        </Cartao>
        <Cartao rotuloAcessivel="Demonstrativo do corretor">
          <Cartao.Cabecalho titulo="Parcela 2 de 3 · corretor" icone={Calculator} meta={<Exemplo />} />
          <Cartao.Corpo>
            <Demonstrativo
              perfil="corretor"
              aoAbrirOrigem={(l) => abrir(l.rotulo)} linhas={comOrigem(linhasDaParcela(PARCELAS[1].p, 'corretor', { venda: VENDA_EXEMPLO, situacaoCorretor: 'prevista' }))}
            />
          </Cartao.Corpo>
        </Cartao>
      </div>
    </Grupo>
  )
}

// ---------------------------------------------------------------------------
// Herói, KPI, Tabela, Estados, Barra
// ---------------------------------------------------------------------------

function GrupoHeroi({ abrir }: { abrir: Abrir }) {
  return (
    <Grupo id="heroi" descricao="Um herói por tela. Ouro é dinheiro realizado, saldo ou obrigação. Previsto leva a palavra no rótulo, fio neutro e número em t1: nunca ouro.">
      <Amostra rotulo="variante ouro · com apoios">
        <Heroi
          variante="ouro"
          rotulo="Saldo nas contas da imobiliária"
          valor={48210.37}
          contar
          aoAbrir={() => abrir('Saldo nas contas')}
          rotuloAcessivel="Abrir o saldo nas contas"
          frase="soma do que está nas contas hoje · não inclui parcelas previstas"
          acao={<Button size="sm" variant="secundario">Ver extrato</Button>}
          apoios={[
            { rotulo: 'Entrou em setembro', valor: 11640, aoAbrir: () => abrir('Entrou em setembro'), rotuloAcessivel: 'Abrir o que entrou em setembro' },
            { rotulo: 'Saiu em setembro', valor: 7920.4, aoAbrir: () => abrir('Saiu em setembro'), rotuloAcessivel: 'Abrir o que saiu em setembro' },
            { rotulo: 'Previsto em outubro', valor: 12000, previsto: true, aoAbrir: () => abrir('Previsto em outubro'), rotuloAcessivel: 'Abrir o previsto de outubro' },
          ]}
        />
      </Amostra>
      <Amostra rotulo="variante previsto">
        <Heroi
          variante="previsto"
          rotulo="Comissão em carteira · prevista"
          valor={24000}
          aoAbrir={() => abrir('Comissão em carteira')}
          rotuloAcessivel="Abrir a comissão em carteira"
          frase="depende de a construtora pagar · comissão contratada, não dinheiro em conta"
          apoios={[
            { rotulo: 'Já recebido nesta carteira', valor: 12000, aoAbrir: () => abrir('Já recebido'), rotuloAcessivel: 'Abrir o que já foi recebido' },
          ]}
        />
      </Amostra>
    </Grupo>
  )
}

function GrupoKpi({ abrir }: { abrir: Abrir }) {
  return (
    <Grupo id="kpi" descricao="KPI não conta nem brilha: número em 28/32, rótulo e ícone. Hover sobe 2px quando abre algo.">
      <div className="grid gap-bloco sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Recebido no mês" valor={11640} icone={ArrowDownToLine} tom="sucesso" aoClicar={() => abrir('Recebido no mês')} />
        <Kpi rotulo="Comissões a pagar" valor={9032.5} icone={HandCoins} tom="atencao" aoClicar={() => abrir('Comissões a pagar')} />
        <Kpi rotulo="Resultado do mês" valor={-8381.94} estado="negativo" icone={TrendingUp} tom="risco" nota="despesas maiores que as receitas" aoClicar={() => abrir('Resultado do mês')} />
        <Kpi rotulo="Vendas no ano" valor={0} texto="7" icone={Handshake} nota="VGV não é receita" aoClicar={() => abrir('Vendas no ano')} />
      </div>
    </Grupo>
  )
}

interface MesDre {
  mes: string
  receita: number
  impostos: number
  comissoes: number
  despesas: number
}

const DRE: MesDre[] = [
  { mes: 'Julho', receita: 24000, impostos: -2160, comissoes: -13104, despesas: -5210.3 },
  { mes: 'Agosto', receita: 12000, impostos: -1080, comissoes: -6552, despesas: -12749.94 },
  { mes: 'Setembro', receita: 12000, impostos: -1080, comissoes: -6552, despesas: -3900 },
]

const resultado = (m: MesDre) => m.receita + m.impostos + m.comissoes + m.despesas

const COLUNAS_DRE: ColunaTabela<MesDre>[] = [
  { id: 'mes', rotulo: 'Mês', celula: (m) => <span className="text-texto-titulo text-t1">{m.mes}</span> },
  { id: 'receita', rotulo: 'Receita', numerica: true, celula: (m) => <Valor posto="fato" valor={m.receita} />, total: <Valor posto="fato" valor={48000} /> },
  { id: 'impostos', rotulo: 'Impostos', numerica: true, celula: (m) => <Valor posto="fato" valor={m.impostos} />, total: <Valor posto="fato" valor={-4320} /> },
  { id: 'comissoes', rotulo: 'Comissões', numerica: true, celula: (m) => <Valor posto="fato" valor={m.comissoes} />, total: <Valor posto="fato" valor={-26208} /> },
  { id: 'despesas', rotulo: 'Despesas', numerica: true, celula: (m) => <Valor posto="fato" valor={m.despesas} />, total: <Valor posto="fato" valor={-21860.24} /> },
  {
    id: 'resultado',
    rotulo: 'Resultado',
    numerica: true,
    celula: (m) => <Valor posto="linha" valor={resultado(m)} estado={resultado(m) < 0 ? 'negativo' : undefined} />,
    total: <Valor posto="linha" estado="negativo" valor={-4388.24} />,
  },
]

function GrupoTabela({ abrir }: { abrir: Abrir }) {
  return (
    <Grupo id="tabela" descricao="Relatório com cabeçalho e total. Sem zebra; a primeira coluna gruda à esquerda no celular.">
      <Cartao rotuloAcessivel="DRE de exemplo">
        <Cartao.Cabecalho titulo="Resultado por mês" icone={FileText} meta={<Exemplo />} />
        <Tabela
          colunas={COLUNAS_DRE}
          linhas={DRE}
          chave={(m) => m.mes}
          rotuloAcessivel="Resultado por mês, exemplo"
          rotuloTotal="Total"
          aoAbrirLinha={(m) => abrir(`Resultado de ${m.mes}`)}
          rotuloAbrir={(m) => `Abrir o resultado de ${m.mes}`}
        />
      </Cartao>
    </Grupo>
  )
}

function GrupoEstados() {
  const toast = useToast()
  const [tentando, setTentando] = useState(0)
  return (
    <Grupo id="estados" descricao="Carregando tem a geometria do conteúdo (sem spinner fora de botão); vazio diz o que fazer; erro diz o motivo e oferece tentar de novo.">
      <div className="grid gap-bloco lg:grid-cols-3">
        <Amostra rotulo="Carregando · dentro do cartão">
          <Cartao rotuloAcessivel="Lista carregando">
            <Cartao.Cabecalho titulo="Parcelas" icone={ListOrdered} />
            <Cartao.Corpo>
              <ListaCarregando linhas={3} contexto="sobreposicao" rotulo="Carregando parcelas" />
            </Cartao.Corpo>
          </Cartao>
        </Amostra>
        <Amostra rotulo="Vazio">
          <Cartao rotuloAcessivel="Estado vazio">
            <Cartao.Corpo>
              <EstadoVazio
                icone={Inbox}
                titulo="Nada a receber neste mês"
                descricao="Quando uma venda tiver parcela prevista para setembro, ela aparece aqui."
                acao={<Button variant="secundario" icone={Plus} onClick={() => toast.showToast({ message: 'No kit nada é gravado.' })}>Registrar venda</Button>}
              />
            </Cartao.Corpo>
          </Cartao>
        </Amostra>
        <Amostra rotulo="Erro">
          <Cartao rotuloAcessivel="Estado de erro">
            <Cartao.Corpo>
              <EstadoErro
                motivo={`Sem conexão com o servidor (tentativa ${tentando + 1}, exemplo).`}
                aoTentarDeNovo={() => setTentando((t) => t + 1)}
              />
            </Cartao.Corpo>
          </Cartao>
        </Amostra>
      </div>
      <div className="grid gap-bloco lg:grid-cols-2">
        <Amostra rotulo="Lista carregando com caixa própria">
          <EsqueletoLista linhas={3} />
        </Amostra>
        <Amostra rotulo="KPIs carregando">
          <EsqueletoCards quantos={2} />
        </Amostra>
      </div>
    </Grupo>
  )
}

function GrupoBarra() {
  const [valor, setValor] = useState(0.33)
  return (
    <Grupo id="barra" descricao="6px, cor lisa, sem brilho nem degradê. Enche uma vez ao aparecer; valor novo troca sem transição.">
      <Cartao rotuloAcessivel="Barras">
        <Cartao.Corpo className="gap-6">
          <Amostra rotulo="Progresso · por tom">
            <div className="flex flex-col gap-3">
              {TONS.map((t, i) => (
                <div key={t} className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-4">
                  <span className="text-texto-meta text-t3">{t}</span>
                  <Barra tom={t} valor={0.2 + i * 0.13} rotuloAcessivel={`${t}, ${Math.round((0.2 + i * 0.13) * 100)}%`} />
                </div>
              ))}
            </div>
          </Amostra>
          <Amostra rotulo="Já entrou da comissão contratada">
            <Barra valor={valor} rotuloAcessivel={`já entrou ${Math.round(valor * 100)}%`} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="num text-texto-meta text-t3">já entrou {Math.round(valor * 100)}%</span>
              <Button size="sm" variant="secundario" onClick={() => setValor((v) => (v >= 1 ? 0.33 : Math.min(1, v + 0.33)))}>
                Trocar valor
              </Button>
            </div>
          </Amostra>
          <Amostra rotulo="Segmentos · trilha da comissão do corretor">
            <BarraTrilha recebido={6552} liberado={2480.5} previsto={13104} />
            <LegendaTrilha />
          </Amostra>
          <Amostra rotulo="Segmentos · legenda livre">
            <Barra rotuloAcessivel="receita 48 mil, despesas 21 mil, exemplo" segmentos={[{ valor: 48000, tom: 'marca' }, { valor: 21860.24, tom: 'neutro' }]} />
            <LegendaBarra itens={[{ tom: 'marca', rotulo: 'receita' }, { tom: 'neutro', rotulo: 'despesas' }]} />
          </Amostra>
        </Cartao.Corpo>
      </Cartao>
    </Grupo>
  )
}

function GrupoSobreposicoes({ abrir, confirmar }: { abrir: Abrir; confirmar: () => void }) {
  const toast = useToast()
  return (
    <Grupo id="sobreposicoes" descricao="Tudo abre de verdade e sai animado; o foco volta a quem abriu. No kit não há banco: nada grava.">
      <Cartao rotuloAcessivel="Sobreposições">
        <Cartao.Corpo className="gap-6">
          <div className="flex flex-wrap gap-3">
            <Button variant="secundario" icone={ListOrdered} onClick={() => abrir('Comissão contratada')}>Painel com drill-down</Button>
            <Button variant="perigo" onClick={confirmar}>Cancelar venda…</Button>
            <Button variant="secundario" onClick={() => toast.showToast({ message: 'Parcela 1 de 3 recebida', detail: 'R$ 11.640,00 na conta da imobiliária (exemplo)', actionLabel: 'Desfazer', onAction: () => undefined })}>
              Toast de sucesso
            </Button>
            <Button variant="fantasma" onClick={() => toast.showToast({ tone: 'error', message: 'Não foi possível salvar', detail: 'Exemplo: sem conexão. O erro não some sozinho.' })}>
              Toast de erro
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-texto-corrido text-t2">O que é “fica para a imobiliária”?</span>
            <Tip>O que sobra da parcela depois do ISS, do Simples e da comissão do corretor. Texto de exemplo.</Tip>
          </div>
          <Dica>Previsão não é dívida nem dinheiro: é o que a construtora ainda deve pagar. <Exemplo /></Dica>
          <Dica tom="atencao">1 comissão recebida e não repassada. <Exemplo /></Dica>
        </Cartao.Corpo>
      </Cartao>
    </Grupo>
  )
}

// ---------------------------------------------------------------------------
// Plantas (9.2 Venda, 9.5 Receber)
// ---------------------------------------------------------------------------

/* O cabeçalho da Parcela lê --colunas; a Lista só declara colunas de Linha. */
const LISTA_PARCELAS = '[--colunas:28px_minmax(9rem,1fr)_8rem_7rem_8rem_8rem_8rem_16px]'

/**
 * Cabeçalho de página (4.2) numa caixa de exemplo.
 * Computador: voltar · ícone · título e subtítulo na mesma linha · ações.
 * Celular: [voltar 44] [título truncado] [⋯ 44] na ficha (sem ícone), ou
 * [ícone 28] [título] [CTA 44 só com o ícone]; o subtítulo desce para o bloco
 * de abertura, logo abaixo, em até 2 linhas.
 */
function CabecalhoFicha({ icone, titulo, subtitulo, acoes, celular, voltar }: { icone: typeof Handshake; titulo: string; subtitulo: string; acoes: ReactNode; celular: ReactNode; voltar?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div data-caixa className="flex min-h-16 items-center gap-3 rounded-caixa border border-fio-caixa bg-surface px-recuo py-4 shadow-card max-lg:gap-2">
        {voltar && <Button variant="fantasma" size="icone" icone={ArrowLeft} aria-label="Voltar para Vendas" />}
        <IconeTom icone={icone} tamanho="sm" className={voltar ? 'hidden' : 'lg:hidden'} />
        <IconeTom icone={icone} className="max-lg:hidden" />
        <div className="flex min-w-0 flex-1 items-baseline gap-3 max-lg:ps-1">
          <h3 className="min-w-0 truncate font-heading text-titulo-pagina-m text-t1 lg:text-titulo-pagina">{titulo}</h3>
          <span title={subtitulo} className="min-w-0 flex-1 truncate text-texto-meta text-t-meta max-lg:hidden">
            {subtitulo}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 max-lg:hidden">{acoes}</div>
        <div className="flex shrink-0 items-center gap-2 lg:hidden">{celular}</div>
      </div>
      <p className="line-clamp-2 text-texto-meta text-t-meta lg:hidden">{subtitulo}</p>
    </div>
  )
}

function PlantaVenda({ abrir, confirmar }: { abrir: Abrir; confirmar: () => void }) {
  return (
    <Grupo id="planta-venda" descricao="A planta 9.2 montada com componentes reais e dados de exemplo: ficha, herói ouro com a conta, os dois lados que nunca somam entre si, parcelas com o marcador de hoje.">
      <div className="flex flex-col gap-bloco">
        <CabecalhoFicha
          voltar
          icone={Handshake}
          titulo="T-1204 · Torre Maré"
          subtitulo="Cliente Exemplo · vendida 12/03/2026 · Corretor Exemplo · exemplo"
          acoes={
            <>
              <Button variant="secundario" onClick={() => abrir('Editar venda')}>Editar</Button>
              <Button variant="fantasma" size="icone" icone={MoreHorizontal} aria-label="Mais ações: reagendar ou cancelar venda" onClick={confirmar} />
            </>
          }
          celular={<Button variant="fantasma" size="icone" icone={MoreHorizontal} aria-label="Mais ações: editar, reagendar ou cancelar venda" onClick={confirmar} />}
        />
        <Heroi
          variante="ouro"
          rotulo="Já ficou para a imobiliária"
          valor={4368}
          contar
          aoAbrir={() => abrir('Já ficou para a imobiliária')}
          rotuloAcessivel="Abrir o que já ficou para a imobiliária"
          frase="de R$ 13.104,00 que a venda deixa · R$ 8.736,00 ainda dependem da construtora (não é caixa)"
          barra={
            <div className="flex flex-col gap-2">
              <Barra valor={1 / 3} rotuloAcessivel="já entrou 33%" />
              <span className="num text-texto-meta text-t3">já entrou 33%</span>
            </div>
          }
          demonstrativo={{ linhas: comOrigem(CONTA_DA_VENDA), perfil: 'admin', rotuloAcessivel: 'A conta da comissão contratada', aoAbrirOrigem: (l) => abrir(l.rotulo) }}
        />
        <div className="grid gap-bloco lg:grid-cols-2">
          <Cartao rotuloAcessivel="Da construtora para a imobiliária">
            <Cartao.Cabecalho titulo="Da construtora para a imobiliária" icone={Building2} />
            <Cartao.Corpo>
              <Barra valor={1 / 3} tom="sucesso" rotuloAcessivel="recebido 33% do contratado" />
            </Cartao.Corpo>
            <Cartao.Lista colunas={{ situacao: true, valor: true, acao: '7rem', fim: true }} rotuloAcessivel="Construtora">
              <Linha titulo="Recebido" meta="1 de 3 parcelas" situacao={<ChipSituacao situacao="recebida" />} valor={<Valor posto="linha" valor={12000} />} aoClicar={() => abrir('Recebido da construtora')} />
              <Linha titulo="A receber" meta="2 parcelas previstas" situacao={<ChipSituacao situacao="prevista" />} valor={<Valor posto="linha" previsto valor={24000} />} aoClicar={() => abrir('A receber da construtora')} />
            </Cartao.Lista>
          </Cartao>
          <Cartao rotuloAcessivel="Da imobiliária para o corretor">
            <Cartao.Cabecalho titulo="Da imobiliária para o corretor" icone={HandCoins} />
            <Cartao.Corpo>
              <Barra valor={1 / 3} tom="sucesso" rotuloAcessivel="pago 33% do contratado" />
            </Cartao.Corpo>
            <Cartao.Lista colunas={{ situacao: true, valor: true, acao: '7rem', fim: true }} rotuloAcessivel="Corretor">
              <Linha titulo="Pago ao Corretor Exemplo" meta="parcela 1 de 3" situacao={<ChipSituacao situacao="recebida" />} valor={<Valor posto="linha" valor={6552} />} aoClicar={() => abrir('Pago ao corretor')} />
              <Linha titulo="Previsto" meta="2 parcelas" situacao={<ChipSituacao situacao="prevista" />} valor={<Valor posto="linha" previsto valor={13104} />} aoClicar={() => abrir('Previsto ao corretor')} />
            </Cartao.Lista>
          </Cartao>
        </div>
        <Cartao rotuloAcessivel="Parcelas">
          <Cartao.Cabecalho titulo="Parcelas" icone={ListOrdered} meta="3 parcelas · 1 recebida" />
          <Cartao.Lista rotuloAcessivel="Parcelas da venda" className={LISTA_PARCELAS}>
            {ParcelasExemplo({ abrir })}
          </Cartao.Lista>
          <Cartao.Rodape>
            <span>já entrou · depende da construtora</span>
            <ParAgoraPrevisto
              agora={{ valor: 12000, aoAbrir: () => abrir('Já entrou'), rotuloAcessivel: 'Abrir o que já entrou' }}
              previsto={{ valor: 24000, aoAbrir: () => abrir('Depende da construtora'), rotuloAcessivel: 'Abrir o que depende da construtora' }}
            />
          </Cartao.Rodape>
        </Cartao>
        <Cartao rotuloAcessivel="Histórico">
          <Cartao.Cabecalho titulo="Histórico" icone={FileText} />
          <Cartao.Lista colunas={{}} rotuloAcessivel="Histórico da venda">
            <Linha titulo="Parcela 1 recebida" meta="02/09/2026 · R$ 11.640,00 na conta" />
            <Linha titulo="Parcela 3 reagendada" meta="20/08/2026 · de 10/10 para 10/11 · observação de exemplo" />
          </Cartao.Lista>
        </Cartao>
      </div>
    </Grupo>
  )
}

function PlantaReceber({ abrir }: { abrir: Abrir }) {
  const [filtro, setFiltro] = useState<'mes' | 'trinta' | 'tudo'>('mes')
  const par = (valor: number, mes: string) => (
    <ParAgoraPrevisto
      agora={{ valor: 0, aoAbrir: () => abrir(`Recebido em ${mes}`), rotuloAcessivel: `Abrir o recebido em ${mes}` }}
      previsto={{ valor, aoAbrir: () => abrir(`Previsto em ${mes}`), rotuloAcessivel: `Abrir o previsto em ${mes}` }}
    />
  )
  return (
    <Grupo id="planta-receber" descricao="A planta 9.5 com o herói previsto: fio neutro, número em t1, a palavra no rótulo e o que ele não é. Os filtros só mexem nas listas.">
      <div className="flex flex-col gap-bloco">
        <CabecalhoFicha
          icone={ArrowDownToLine}
          titulo="A receber"
          subtitulo="R$ 24.000,00 previstos · exemplo"
          acoes={<Button icone={Plus} onClick={() => abrir('Registrar venda')}>Registrar venda</Button>}
          celular={<Button size="icone" icone={Plus} aria-label="Registrar venda" onClick={() => abrir('Registrar venda')} />}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <SeletorMesExemplo />
          <FiltrosRapidos
            rotuloAcessivel="Período das listas de Receber"
            ativo={filtro}
            aoMudar={setFiltro}
            filtros={[
              { id: 'mes', rotulo: 'Este mês', contador: 1 },
              { id: 'trinta', rotulo: '30 dias', contador: 2 },
              { id: 'tudo', rotulo: 'Tudo', contador: 2 },
            ]}
          />
        </div>
        <Heroi
          variante="previsto"
          rotulo="A receber · previsto"
          valor={24000}
          aoAbrir={() => abrir('A receber')}
          rotuloAcessivel="Abrir as parcelas a receber"
          frase="depende de a construtora pagar · comissão contratada, não dinheiro em conta"
          apoios={[
            { rotulo: 'Caiu na conta em setembro', valor: 11640, aoAbrir: () => abrir('Caiu na conta em setembro'), rotuloAcessivel: 'Abrir o que caiu na conta em setembro' },
          ]}
        />
        <Cartao rotuloAcessivel="A seguir">
          <Cartao.Cabecalho titulo="A seguir" icone={ListOrdered} meta="2 parcelas" />
          <Cartao.Lista colunas={{ goteira: true, valor: true, acao: '7rem', fim: true }} rotuloAcessivel="Parcelas a seguir">
            <LinhaGrupo rotulo="Outubro de 2026" contador="1 parcela" par={par(12000, 'outubro')} />
            <Linha
              goteira={<Selo situacao="prevista" idx={2} count={3} />}
              titulo="T-1204 · parcela 2 de 3"
              meta="Cliente Exemplo · prevista para 10/10"
              valor={<Valor posto="linha" previsto valor={12000} />}
              acao={<Button size="sm" variant="secundario" onClick={() => abrir('Receber parcela 2')}>Recebi</Button>}
              aoClicar={() => abrir('T-1204 · parcela 2 de 3')}
            />
            <LinhaGrupo rotulo="Novembro de 2026" contador="1 parcela" par={par(12000, 'novembro')} />
            <Linha
              goteira={<Selo situacao="prevista" idx={3} count={3} />}
              titulo="T-1204 · parcela 3 de 3"
              meta="Cliente Exemplo · prevista para 10/11"
              valor={<Valor posto="linha" previsto valor={12000} />}
              acao={<Button size="sm" variant="secundario" onClick={() => abrir('Receber parcela 3')}>Recebi</Button>}
              aoClicar={() => abrir('T-1204 · parcela 3 de 3')}
            />
          </Cartao.Lista>
        </Cartao>
      </div>
    </Grupo>
  )
}

// ---------------------------------------------------------------------------
// Kit
// ---------------------------------------------------------------------------

export function Kit() {
  const [claro, trocarTema] = useTema()
  const toast = useToast()
  const [painel, setPainel] = useState<string | null>(null)
  const [nivel, setNivel] = useState(0)
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const abrir: Abrir = (titulo) => {
    setNivel(0)
    setPainel(titulo)
  }
  const confirmar = () => setConfirmando(true)
  const aoConfirmar = () => {
    setOcupado(true)
    window.setTimeout(() => {
      setOcupado(false)
      setConfirmando(false)
      toast.showToast({ message: 'Venda cancelada (exemplo)', detail: 'No kit nada é gravado.' })
    }, 1200)
  }

  useEffect(() => {
    document.title = 'Kit visual · Souza Imobiliária'
  }, [])

  return (
    <div className="min-h-screen bg-page-bg text-t2">
      <header className="cabecalho">
        <div className="conteudo flex h-14 items-center justify-between gap-4 lg:h-16">
          <div data-marca className="flex items-center gap-4">
            <Lockup tema={claro ? 'claro' : 'escuro'} className="h-8 w-auto" />
            <span className="hidden text-texto-meta text-t-meta md:inline">Kit visual · componentes reais, dados de exemplo</span>
          </div>
          <div role="group" aria-label="Aparência" className="flex items-center gap-2">
            <Button size="sm" variant={claro ? 'secundario' : 'fantasma'} icone={Sun} aria-pressed={claro} onClick={() => trocarTema(true)}>
              Claro
            </Button>
            <Button size="sm" variant={claro ? 'fantasma' : 'secundario'} icone={Moon} aria-pressed={!claro} onClick={() => trocarTema(false)}>
              Escuro
            </Button>
          </div>
        </div>
      </header>

      <main className="conteudo flex flex-col gap-secao pb-barra-inferior pt-topo">
        <nav aria-label="Grupos do kit" className="flex flex-wrap gap-2">
          {GRUPOS.map(([id, nome]) => (
            <a
              key={id}
              href={`#${id}`}
              className="text-botao-secundario inline-flex h-11 items-center rounded-controle lg:h-8 border border-fio-linha bg-surface px-3 text-t2 hover:bg-linha-hover hover:text-t1"
            >
              {nome}
            </a>
          ))}
        </nav>
        <GrupoEspaco />
        <GrupoTipo />
        <GrupoValor abrir={abrir} />
        <GrupoSituacao />
        <GrupoBotoes />
        <GrupoCampos />
        <GrupoControles />
        <GrupoListas abrir={abrir} />
        <GrupoParcela abrir={abrir} />
        <GrupoDemonstrativo abrir={abrir} />
        <GrupoHeroi abrir={abrir} />
        <GrupoKpi abrir={abrir} />
        <GrupoTabela abrir={abrir} />
        <GrupoEstados />
        <GrupoBarra />
        <GrupoSobreposicoes abrir={abrir} confirmar={confirmar} />
        <PlantaVenda abrir={abrir} confirmar={confirmar} />
        <PlantaReceber abrir={abrir} />
      </main>

      <SidePanel
        aberto={painel !== null}
        aoFechar={() => setPainel(null)}
        titulo={nivel === 0 ? painel ?? '' : 'Parcela 1 de 3'}
        subtitulo={nivel === 0 ? 'O que compõe este número · exemplo' : 'T-1204 · Torre Maré · exemplo'}
        largura="lg"
        nivel={nivel}
        aoVoltar={nivel > 0 ? () => setNivel(0) : undefined}
        rotuloVoltar={painel ?? 'Voltar'}
        resumo={
          <span className="flex flex-col">
            <span className="text-texto-meta text-t-meta">Total</span>
            <Valor posto="destaque" valor={nivel === 0 ? 36000 : 12000} />
          </span>
        }
        rodape={
          <Button size="lg" variant="secundario" onClick={() => setPainel(null)}>
            Fechar
          </Button>
        }
      >
        {nivel === 0 ? (
          <Lista contexto="sobreposicao" colunas={{ goteira: true, situacao: true, valor: true, fim: true }} rotuloAcessivel="Parcelas que compõem">
            {PARCELAS.map(({ p, situacao }) => (
              <Linha
                key={p.id}
                goteira={<Selo situacao={situacao} idx={p.idx} count={p.count} />}
                titulo={`Parcela ${p.idx} de ${p.count}`}
                meta={<FraseDeTempo situacao={situacao} prevista={p.expected_date} recebida={p.received_date} />}
                situacao={<ChipSituacao situacao={situacao} />}
                valor={<Valor posto="linha" previsto={situacao === 'prevista' ? true : undefined} valor={p.amount} />}
                aoClicar={() => setNivel(1)}
              />
            ))}
          </Lista>
        ) : (
          <Demonstrativo perfil="admin" tudoEntrou aoAbrirOrigem={(l) => abrir(l.rotulo)} linhas={comOrigem(linhasDaParcela(PARCELAS[0].p, 'admin', { venda: VENDA_EXEMPLO, situacaoCorretor: 'recebida' }))} />
        )}
      </SidePanel>

      <ConfirmDialog
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        titulo="Cancelar a venda T-1204?"
        descricao="As 2 parcelas previstas (R$ 24.000,00) deixam de ser esperadas. A parcela recebida continua no histórico. Exemplo: nada é gravado."
        rotuloConfirmar="Cancelar venda"
        tom="risco"
        aoConfirmar={aoConfirmar}
        ocupado={ocupado}
      />
    </div>
  )
}
