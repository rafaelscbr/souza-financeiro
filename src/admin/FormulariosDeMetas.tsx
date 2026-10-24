import { useEffect, useMemo, useState } from 'react'
import { Percent, Target, UserRound } from 'lucide-react'
import { useAdmin } from './AdminData'
import { SidePanel } from '@/components/ui/SidePanel'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput, PercentInput } from '@/components/ui/MoneyInput'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/format'
import { configVigente, NOME_DO_NIVEL, type Percentuais } from '@/lib/comissao'
import type { BrokerProfile, NivelCorretor, SalesGoal } from '@/types'
import { BlocoDaFolha, EscolhaDaFolha, RodapeDaFolha } from './FolhaDeLancamento'

/*
 * OS TRÊS CADASTROS DO PLANO DE CARREIRA (Fase 1, 23/10/2026): a meta, os
 * percentuais e o perfil de cada corretor. Tudo editável pelo Rafael, como ele
 * pediu ("essa % o ganho do Dionata é um campo onde eu posso alterar").
 */

const chaveDoMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const somarMeses = (mes: string, n: number) => {
  const [a, m] = mes.split('-').map(Number)
  return chaveDoMes(new Date(a, m - 1 + n, 1))
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export function FormMeta({ aberto, meta, aoFechar }: { aberto: boolean; meta: SalesGoal | null; aoFechar: () => void }) {
  const { contacts, salvarMeta, excluirMeta, mes } = useAdmin()
  const { showToast } = useToast()
  const [quem, setQuem] = useState('')
  const [valor, setValor] = useState<number | null>(null)
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  // Corretor novo (decisão de 22/10): R$ 420 mil nos 2 primeiros meses, depois a meta cheia.
  const [rampa, setRampa] = useState(false)
  const [valorRampa, setValorRampa] = useState<number | null>(420000)
  const [salvando, setSalvando] = useState(false)
  const [apagar, setApagar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const corretores = useMemo(() => contacts.filter((c) => c.type === 'broker' && c.is_active), [contacts])

  useEffect(() => {
    if (!aberto) return
    setQuem(meta ? meta.contact_id ?? 'geral' : '')
    setValor(meta?.monthly_vgv ?? null)
    setDe(meta?.start_month.slice(0, 7) ?? chaveDoMes(mes))
    setAte(meta?.end_month?.slice(0, 7) ?? '')
    setRampa(false)
    setValorRampa(420000)
    setErro(null)
  }, [aberto, meta, mes])

  async function salvar() {
    setErro(null)
    if (!quem) return setErro('Escolha de quem é a meta: da imobiliária ou de um corretor.')
    if (!valor || valor <= 0) return setErro('Informe a meta de VGV por mês, em reais.')
    if (!de) return setErro('Informe a partir de que mês a meta vale.')
    if (ate && ate < de) return setErro('O último mês não pode vir antes do primeiro.')
    if (rampa && (!valorRampa || valorRampa <= 0)) return setErro('Informe a meta dos 2 primeiros meses.')
    setSalvando(true)
    try {
      const contact_id = quem === 'geral' ? null : quem
      if (rampa && !meta) {
        await salvarMeta({ contact_id, monthly_vgv: valorRampa!, start_month: `${de}-01`, end_month: `${somarMeses(de, 1)}-01`, notes: 'primeiros 2 meses' })
        await salvarMeta({ contact_id, monthly_vgv: valor, start_month: `${somarMeses(de, 2)}-01`, end_month: ate ? `${ate}-01` : null, notes: null })
      } else {
        await salvarMeta({ id: meta?.id, contact_id, monthly_vgv: valor, start_month: `${de}-01`, end_month: ate ? `${ate}-01` : null })
      }
      showToast({ message: meta ? 'Meta atualizada' : 'Meta cadastrada', detail: `${formatCurrency(valor)} de VGV por mês` })
      aoFechar()
    } catch (e) {
      setErro(e instanceof Error ? `Não foi gravada: ${e.message}` : 'Não foi gravada. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <SidePanel
        aberto={aberto}
        aoFechar={() => !salvando && aoFechar()}
        titulo={meta ? 'Meta de VGV' : 'Nova meta de VGV'}
        subtitulo="Quanto vender por mês"
        rodape={
          <RodapeDaFolha erro={erro} tituloDoErro="Meta não salva">
            {meta && (
              <Button variant="perigo" size="lg" onClick={() => setApagar(true)} disabled={salvando}>
                Apagar
              </Button>
            )}
            <Button variant="secundario" size="lg" onClick={aoFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="primario" size="lg" onClick={salvar} carregando={salvando}>
              Salvar meta
            </Button>
          </RodapeDaFolha>
        }
      >
        <BlocoDaFolha titulo="A meta" icone={Target}>
          <FormField label="De quem é" htmlFor="m-quem" required>
            <Select id="m-quem" value={quem} onChange={(e) => setQuem(e.target.value)} data-foco-inicial>
              <option value="">Escolher…</option>
              <option value="geral">Imobiliária (meta geral)</option>
              {corretores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="VGV por mês" htmlFor="m-valor" required hint="valor geral vendido: o imóvel inteiro, mesmo em parceria">
            <CurrencyInput id="m-valor" value={valor} onChange={setValor} />
          </FormField>
          <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
            <FormField label="A partir de" htmlFor="m-de" required>
              <Input id="m-de" type="month" value={de} onChange={(e) => setDe(e.target.value)} />
            </FormField>
            <FormField label="Até" htmlFor="m-ate" hint="vazio = sem data para acabar">
              <Input id="m-ate" type="month" value={ate} onChange={(e) => setAte(e.target.value)} />
            </FormField>
          </div>
          {!meta && quem && quem !== 'geral' && (
            <EscolhaDaFolha rotulo="Corretor novo?" hint="cria duas metas: uma menor nos 2 primeiros meses e a cheia depois">
              <FiltrosRapidos
                rotuloAcessivel="Corretor novo"
                ativo={rampa ? 'sim' : 'nao'}
                aoMudar={(v) => setRampa(v === 'sim')}
                filtros={[
                  { id: 'nao', rotulo: 'Não' },
                  { id: 'sim', rotulo: 'Sim, com rampa' },
                ]}
              />
            </EscolhaDaFolha>
          )}
          {rampa && !meta && (
            <FormField label="Meta dos 2 primeiros meses" htmlFor="m-rampa" hint="ex.: um studio de R$ 420 mil">
              <CurrencyInput id="m-rampa" value={valorRampa} onChange={setValorRampa} />
            </FormField>
          )}
        </BlocoDaFolha>
      </SidePanel>
      <ConfirmDialog
        aberto={apagar}
        aoFechar={() => setApagar(false)}
        titulo="Apagar esta meta?"
        descricao="A meta sai do acompanhamento. Nenhuma venda é alterada."
        rotuloConfirmar="Apagar meta"
        tom="risco"
        aoConfirmar={async () => {
          if (!meta) return
          await excluirMeta(meta.id)
          setApagar(false)
          aoFechar()
        }}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Percentuais
// ---------------------------------------------------------------------------

const CAMPOS_PCT: { chave: keyof Percentuais; rotulo: string; dica: string }[] = [
  { chave: 'launch_commission_pct', rotulo: 'Comissão em lançamento', dica: '% do VGV, padrão ao lançar a venda' },
  { chave: 'resale_commission_pct', rotulo: 'Comissão em imóvel de terceiros', dica: '% do VGV, padrão ao lançar a venda' },
  { chave: 'iss_pct', rotulo: 'ISS', dica: 'só quando a construtora retém na fonte' },
  { chave: 'das_pct', rotulo: 'DAS (Simples)', dica: 'sobre a comissão menos o ISS' },
  { chave: 'manager_base_pct', rotulo: 'Gestão do gestor', dica: 'sobre a base das vendas do time' },
  { chave: 'manager_bonus_pct', rotulo: 'Gestão com a meta geral batida', dica: 'substitui a gestão base no mês da meta' },
  { chave: 'level1_pct', rotulo: 'Nível 1 · Corretor', dica: '% da base' },
  { chave: 'level2_pct', rotulo: 'Nível 2 · Pleno', dica: '% da base' },
  { chave: 'level3_pct', rotulo: 'Nível 3 · Sênior', dica: '% da base' },
]
const CAMPOS_VGV: { chave: keyof Percentuais; rotulo: string; dica: string }[] = [
  { chave: 'level2_from_vgv', rotulo: 'Vira Pleno a partir de', dica: 'VGV acumulado' },
  { chave: 'level3_from_vgv', rotulo: 'Vira Sênior a partir de', dica: 'VGV acumulado' },
  { chave: 'maintenance_vgv_12m', rotulo: 'Manutenção do nível', dica: 'VGV mínimo nos últimos 12 meses' },
]

export function FormPercentuais({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { configuracoes, salvarConfiguracao, mes } = useAdmin()
  const { showToast } = useToast()
  const [valores, setValores] = useState<Partial<Record<keyof Percentuais, number | null>>>({})
  const [de, setDe] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    const atual = configVigente(configuracoes, `${chaveDoMes(mes)}-01`)
    setValores(Object.fromEntries([...CAMPOS_PCT, ...CAMPOS_VGV].map((c) => [c.chave, atual[c.chave]])))
    setDe(chaveDoMes(mes))
    setErro(null)
  }, [aberto, configuracoes, mes])

  async function salvar() {
    setErro(null)
    const faltando = [...CAMPOS_PCT, ...CAMPOS_VGV].find((c) => valores[c.chave] == null)
    if (faltando) return setErro(`Preencha "${faltando.rotulo}".`)
    if (!de) return setErro('Informe a partir de que mês os percentuais valem.')
    setSalvando(true)
    try {
      await salvarConfiguracao({ valid_from: `${de}-01`, ...(valores as Record<keyof Percentuais, number>) })
      showToast({ message: 'Percentuais atualizados', detail: `valem a partir de ${de.split('-').reverse().join('/')}` })
      aoFechar()
    } catch (e) {
      setErro(e instanceof Error ? `Não foi gravado: ${e.message}` : 'Não foi gravado. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  const campo = (c: { chave: keyof Percentuais; rotulo: string; dica: string }, dinheiro: boolean) => (
    <FormField key={c.chave} label={c.rotulo} htmlFor={`p-${c.chave}`} hint={c.dica}>
      {dinheiro ? (
        <CurrencyInput id={`p-${c.chave}`} value={valores[c.chave] ?? null} onChange={(v) => setValores((x) => ({ ...x, [c.chave]: v }))} />
      ) : (
        <PercentInput id={`p-${c.chave}`} value={valores[c.chave] ?? null} onChange={(v) => setValores((x) => ({ ...x, [c.chave]: v }))} />
      )}
    </FormField>
  )

  return (
    <SidePanel
      aberto={aberto}
      aoFechar={() => !salvando && aoFechar()}
      titulo="Percentuais e plano de carreira"
      subtitulo="Valem daqui em diante; venda já lançada não muda"
      largura="lg"
      rodape={
        <RodapeDaFolha erro={erro} tituloDoErro="Percentuais não salvos">
          <Button variant="secundario" size="lg" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primario" size="lg" onClick={salvar} carregando={salvando}>
            Salvar percentuais
          </Button>
        </RodapeDaFolha>
      }
    >
      <BlocoDaFolha titulo="Os percentuais" icone={Percent}>
        <FormField label="Valem a partir de" htmlFor="p-de" hint="mudar um % não reescreve vendas já lançadas">
          <Input id="p-de" type="month" value={de} onChange={(e) => setDe(e.target.value)} />
        </FormField>
        <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">{CAMPOS_PCT.map((c) => campo(c, false))}</div>
        <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">{CAMPOS_VGV.map((c) => campo(c, true))}</div>
      </BlocoDaFolha>
    </SidePanel>
  )
}

// ---------------------------------------------------------------------------
// Perfil do corretor
// ---------------------------------------------------------------------------

export function FormPerfil({ aberto, contactId, aoFechar }: { aberto: boolean; contactId: string | null; aoFechar: () => void }) {
  const { contacts, perfis, salvarPerfil } = useAdmin()
  const { showToast } = useToast()
  const perfil: BrokerProfile | undefined = perfis.find((p) => p.contact_id === contactId)
  const nome = contacts.find((c) => c.id === contactId)?.name ?? 'Corretor'
  const outros = useMemo(() => contacts.filter((c) => c.type === 'broker' && c.is_active && c.id !== contactId), [contacts, contactId])
  const [gestor, setGestor] = useState('')
  const [nivel, setNivel] = useState<NivelCorretor | ''>('')
  const [pct, setPct] = useState<number | null>(null)
  const [contaMeta, setContaMeta] = useState(true)
  const [ehGestor, setEhGestor] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    setGestor(perfil?.manager_id ?? '')
    setNivel(perfil?.level_override ?? '')
    setPct(perfil?.pct_override ?? null)
    setContaMeta(perfil?.counts_for_goals ?? true)
    setEhGestor(perfil?.is_manager ?? false)
    setErro(null)
  }, [aberto, perfil])

  async function salvar() {
    if (!contactId) return
    setSalvando(true)
    setErro(null)
    try {
      await salvarPerfil({
        contact_id: contactId,
        manager_id: gestor || null,
        level_override: nivel || null,
        pct_override: pct,
        counts_for_goals: contaMeta,
        is_manager: ehGestor,
      })
      showToast({ message: 'Plano de carreira atualizado', detail: nome })
      aoFechar()
    } catch (e) {
      setErro(e instanceof Error ? `Não foi gravado: ${e.message}` : 'Não foi gravado. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <SidePanel
      aberto={aberto}
      aoFechar={() => !salvando && aoFechar()}
      titulo={nome}
      subtitulo="Plano de carreira e time"
      rodape={
        <RodapeDaFolha erro={erro} tituloDoErro="Não salvo">
          <Button variant="secundario" size="lg" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primario" size="lg" onClick={salvar} carregando={salvando}>
            Salvar
          </Button>
        </RodapeDaFolha>
      }
    >
      <BlocoDaFolha titulo="O corretor" icone={UserRound}>
        <FormField label="Nível" htmlFor="pf-nivel" hint="vazio = o nível sai do VGV acumulado">
          <Select id="pf-nivel" value={nivel} onChange={(e) => setNivel(e.target.value as NivelCorretor | '')} data-foco-inicial>
            <option value="">Pelo VGV acumulado</option>
            {(['corretor', 'pleno', 'senior'] as NivelCorretor[]).map((n) => (
              <option key={n} value={n}>
                {NOME_DO_NIVEL[n]} (decisão da diretoria)
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="% próprio" htmlFor="pf-pct" hint="vazio = o % do nível. Use só para acerto fora da tabela">
          <PercentInput id="pf-pct" value={pct} onChange={setPct} />
        </FormField>
        <FormField label="Gestor do time" htmlFor="pf-gestor" hint="quem ganha a gestão sobre as vendas deste corretor">
          <Select id="pf-gestor" value={gestor} onChange={(e) => setGestor(e.target.value)}>
            <option value="">Sem gestor</option>
            {outros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <EscolhaDaFolha rotulo="É gestor de equipe?">
          <FiltrosRapidos
            rotuloAcessivel="É gestor"
            ativo={ehGestor ? 'sim' : 'nao'}
            aoMudar={(v) => setEhGestor(v === 'sim')}
            filtros={[
              { id: 'nao', rotulo: 'Não' },
              { id: 'sim', rotulo: 'Sim' },
            ]}
          />
        </EscolhaDaFolha>
        <EscolhaDaFolha rotulo="As vendas dele contam para a meta?" hint="as do Rafael não contam">
          <FiltrosRapidos
            rotuloAcessivel="Conta para a meta"
            ativo={contaMeta ? 'sim' : 'nao'}
            aoMudar={(v) => setContaMeta(v === 'sim')}
            filtros={[
              { id: 'sim', rotulo: 'Contam' },
              { id: 'nao', rotulo: 'Não contam' },
            ]}
          />
        </EscolhaDaFolha>
      </BlocoDaFolha>
    </SidePanel>
  )
}
