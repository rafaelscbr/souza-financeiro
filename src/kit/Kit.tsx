import { useState } from 'react'
import { Simbolo, Lockup } from '@/components/marca/Marca'
import { Assinatura, Heroi } from '@/components/ui/Assinatura'
import { Secao, SubtotalDuplo } from '@/components/ui/Secao'
import { Lista, Linha, LinhaDeHoje } from '@/components/ui/Lista'
import { Valor, ValorComOrigem, Metrica } from '@/components/ui/Valor'
import { Selo, Marcador } from '@/components/ui/Selo'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Cascata, LinhaCascata, TotalCascata } from '@/components/ui/Cascata'
import { Trilha, LegendaTrilha } from '@/components/ui/Trilha'
import { ListaCarregando } from '@/components/ui/Esqueleto'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { VOCABULARIO, type Situacao } from '@/lib/situacao'

/*
 * AMOSTRA DO SISTEMA VISUAL.
 *
 * Renderiza os componentes REAIS do kit, com dados FICTÍCIOS — nenhum número
 * aqui é da Souza Imobiliária. Serve para duas coisas: conferir o sistema sem
 * precisar de login, e discutir a direção olhando a coisa em vez do texto.
 *
 * Servida só em desenvolvimento (`kit.html` não entra no build de produção,
 * porque só `index.html` está na entrada do Vite).
 */

const FICT = [
  { id: '1', titulo: 'Residencial Miramar 1204', dev: 'Torre Norte', idx: 3, count: 9, valor: 2692.89, s: 'liberada' as Situacao, prev: '2026-09-02', lib: '2026-09-02' },
  { id: '2', titulo: 'Residencial Miramar 1204', dev: 'Torre Norte', idx: 4, count: 9, valor: 201.61, s: 'prevista' as Situacao, prev: '2026-10-12' },
  { id: '3', titulo: 'Edifício Aurora 802', dev: 'Aurora', idx: 1, count: 3, valor: 1480.5, s: 'vencida' as Situacao, prev: '2026-08-29', lib: '2026-08-29' },
  { id: '4', titulo: 'Edifício Aurora 802', dev: 'Aurora', idx: 2, count: 3, valor: 1480.5, s: 'recebida' as Situacao, prev: '2026-07-15', rec: '2026-07-15' },
  { id: '5', titulo: 'Vista Mar 301', dev: 'Vista Mar', idx: 2, count: 6, valor: 940.0, s: 'cancelada' as Situacao, prev: '2026-06-10' },
]

export function Kit() {
  const [tema, setTema] = useState<'light' | 'dark'>(
    (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') ?? 'light',
  )
  const trocar = (t: 'light' | 'dark') => {
    setTema(t)
    document.documentElement.setAttribute('data-theme', t)
    try {
      localStorage.setItem('sgf.theme', t)
    } catch {
      /* ignora */
    }
  }

  return (
    <div className="min-h-screen bg-papel px-5 py-8 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4">
          <div>
            <Assinatura>Kit visual</Assinatura>
            <h1 className="mt-1 text-lg font-semibold text-content">
              Componentes reais, dados fictícios
            </h1>
            <p className="mt-1 text-base text-content-muted">
              Nenhum número desta página é da Souza Imobiliária.
            </p>
          </div>
          <Segmented
            value={tema}
            onChange={trocar}
            ariaLabel="Tema"
            options={[
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Escuro' },
            ]}
            className="w-44"
          />
        </div>

        <Secao titulo="A marca" variante="simples">
          <div className="flex flex-wrap items-end gap-8 py-3">
            <div className="space-y-2">
              <Lockup className="h-auto w-64" tema={tema === 'dark' ? 'escuro' : 'claro'} />
              <p className="text-sm text-content-faint">lockup 960×272, o símbolo pende 24px</p>
            </div>
            <div className="flex items-end gap-4">
              {[
                { n: 80, c: 'h-20 w-20' },
                { n: 48, c: 'h-12 w-12' },
                { n: 32, c: 'h-8 w-8' },
                { n: 24, c: 'h-6 w-6' },
              ].map(({ n, c }) => (
                <div key={n} className="space-y-1 text-center">
                  <Simbolo className={`text-content ${c}`} />
                  <p className="text-xs text-content-faint">{n}px</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-content-muted">
            Raio percentual de 24%: o símbolo é o mesmo objeto em qualquer tamanho.
          </p>
        </Secao>

        <Secao titulo="O número herói" variante="simples">
          <Heroi
            rotulo="A receber agora"
            tom="ouro"
            acao={<Button>Pagar comissão</Button>}
            apoio={
              <>
                <span className="cifra text-lg font-bold text-action">R$ 18.402,10</span>
                <span className="text-base text-content-muted">já pago no ano</span>
                <ChipSituacao situacao="liberada" />
              </>
            }
            contexto="A imobiliária já recebeu estas parcelas. É dinheiro seu, esperando o repasse."
            rodape={
              <div className="space-y-2">
                <Trilha recebido={18402} liberado={24044} previsto={9800} />
                <LegendaTrilha />
              </div>
            }
          >
            <Valor valor={24044.58} posto="heroi" />
          </Heroi>
          <p className="text-sm text-content-muted">
            Um por tela, e só um. O ponto de ouro vive dentro do rótulo, não na lembrança de quem
            edita.
          </p>
        </Secao>

        <Secao titulo="Os três postos do dinheiro">
          <div className="space-y-4 py-2">
            <Metrica rotulo="herói — a resposta da tela">
              <Valor valor={24044.58} posto="heroi" />
            </Metrica>
            <Metrica rotulo="linha — o degrau de comparação">
              <Valor valor={2692.89} posto="linha" />
            </Metrica>
            <Metrica rotulo="fato — um dado dentro de uma conta">
              <Valor valor={201.61} posto="fato" />
            </Metrica>
            <Metrica rotulo="negativo, com o menos de verdade em calha própria">
              <Valor valor={-1000.5} posto="linha" tinta="text-critical" />
            </Metrica>
          </div>
        </Secao>

        <Secao titulo="As cinco situações" tom="ouro">
          <div className="space-y-3 py-2">
            {(Object.keys(VOCABULARIO) as Situacao[]).map((s) => (
              <div key={s} className="flex flex-wrap items-center gap-3">
                <Selo situacao={s} idx={3} count={9} />
                <ChipSituacao situacao={s} />
                <ChipSituacao situacao={s} perfil="corretor" />
                <span className="text-content-muted">
                  <Marcador situacao={s} />
                </span>
                <FraseDeTempo situacao={s} prevista="2026-09-02" liberada="2026-09-02" recebida="2026-09-02" />
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-content-muted">
            Quatro sinais redundantes. Em escala de cinza: vazio · médio · médio com anel · escuro ·
            riscado.
          </p>
        </Secao>

        <Secao
          tom="critico"
          titulo="A lista, com a linha de hoje"
          subtotal={
            <SubtotalDuplo
              agora={<Valor valor={4173.39} posto="fato" />}
              previsto={<Valor valor={201.61} posto="fato" tinta="text-content-muted" />}
            />
          }
        >
          <Lista>
            {FICT.slice(0, 3).map((f) => (
              <Linha
                key={f.id}
                selo={<Selo situacao={f.s} idx={f.idx} count={f.count} />}
                titulo={f.titulo}
                meta={
                  <FraseDeTempo situacao={f.s} prevista={f.prev} liberada={f.lib} recebida={f.rec} />
                }
                situacao={<ChipSituacao situacao={f.s} />}
                valor={<Valor valor={f.valor} posto="linha" />}
                para="/"
              />
            ))}
            <LinhaDeHoje />
            {FICT.slice(3).map((f) => (
              <Linha
                key={f.id}
                selo={<Selo situacao={f.s} idx={f.idx} count={f.count} />}
                titulo={f.titulo}
                meta={
                  <FraseDeTempo situacao={f.s} prevista={f.prev} liberada={f.lib} recebida={f.rec} />
                }
                situacao={<ChipSituacao situacao={f.s} />}
                valor={<Valor valor={f.valor} posto="linha" />}
                para="/"
              />
            ))}
          </Lista>
        </Secao>

        <Secao titulo="Nenhum número sem origem" tom="ouro">
          <Lista>
            <Linha
              titulo="Comissão a pagar"
              meta="clique no valor para ver de quais vendas vem"
              valor={
                <ValorComOrigem
                  valor={4173.39}
                  rotuloAcessivel="Ver de onde vem"
                  aoAbrir={() => alert('Na aplicação, abre a folha com as parcelas de origem.')}
                />
              }
            />
          </Lista>
        </Secao>

        <Secao titulo="A cascata — a conta da comissão" tom="verde">
          <div className="py-2">
            <Cascata>
              <LinhaCascata rotulo="Parcela da comissão" valor={4489.14} />
              <LinhaCascata rotulo="ISS retido na fonte" detalhe="3% · a construtora desconta no ato" valor={134.67} subtracao />
              <LinhaCascata rotulo="Imposto (Simples 6%)" detalhe="sobre a base líquida de ISS" valor={261.27} subtracao />
              <LinhaCascata rotulo="Base do corretor" valor={4093.2} />
              <LinhaCascata rotulo="Comissão do corretor" detalhe="base × 65%" valor={2660.58} />
              <LinhaCascata rotulo="Desconto combinado" valor={399.44} subtracao />
              <TotalCascata rotulo="Fica para a imobiliária" valor={1832.06} />
            </Cascata>
          </div>
        </Secao>

        <Secao titulo="A trilha — três estados numa barra">
          <div className="space-y-2 py-2">
            <Trilha recebido={12000} liberado={4173} previsto={8000} />
            <LegendaTrilha />
          </div>
        </Secao>

        <Secao titulo="Formulário">
          <div className="max-w-sm space-y-4 py-2">
            <FormField label="Valor recebido" htmlFor="k1" hint="o valor do extrato, não o da parcela">
              <Input id="k1" defaultValue="2.692,89" />
            </FormField>
            <FormField label="Conta" htmlFor="k2">
              <Select id="k2" defaultValue="a">
                <option value="a">Conta corrente</option>
                <option value="b">Caixa</option>
              </Select>
            </FormField>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1">
                Cancelar
              </Button>
              <Button className="flex-1">Confirmar</Button>
            </div>
          </div>
        </Secao>

        <Secao titulo="Carregando, e vazio">
          <ListaCarregando linhas={3} />
          <div className="mt-6">
            <EmptyState
              title="Nada por aqui ainda"
              description="Suas vendas aparecem assim que a imobiliária registrar a primeira."
            />
          </div>
        </Secao>
      </div>
    </div>
  )
}
