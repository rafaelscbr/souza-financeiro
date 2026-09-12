# Souza Imobiliária — vendas e financeiro

Sistema dedicado à operação da Souza Imobiliária, com dois perfis:

- **Administrador** registra vendas, confirma recebimentos e pagamentos, lança
  despesas, cadastra corretores e lê os relatórios.
- **Corretor** entra com login próprio e consulta apenas as suas vendas, o VGV,
  a comissão e o cronograma de recebimentos.

Substitui o "Souza Group Finance", que atendia quatro razões contábeis no mesmo
banco (três empresas mais o financeiro pessoal do dono). O código antigo
continua no branch `main` e na tag `multiempresa-final` até o corte.

---

## Estado: o que falta para entrar no ar

O aplicativo está pronto e testado, mas **depende de um passo que só o Rafael
pode fazer**: aplicar as migrações no SQL Editor do Supabase. Não é possível
executar DDL pela API (nem a chave `service_role` cria tabela), então o
`create table` precisa ser colado no painel.

### 1. Aplicar as migrações

Supabase → SQL Editor → colar e rodar, **nesta ordem**:

| Arquivo | O que faz |
| --- | --- |
| `supabase/migrations/007_perfis_e_acesso.sql` | Perfis (admin/corretor) e fecha a RLS, que hoje libera tudo para qualquer usuário logado |
| `008_vendas.sql` | Tabelas `sales` e `sale_installments`, e o vínculo com o razão |
| `009_funcoes_de_venda.sql` | Registrar venda, receber parcela, pagar comissão, reagendar, cancelar |
| `010_area_do_corretor.sql` | As quatro funções que o corretor usa |
| `011_migra_vendas_antigas.sql` | Cria a função que migra as vendas existentes |
| `012_arquivo.sql` | Cria as funções de arquivamento (não move nada ainda) |

Todas são idempotentes e trazem o bloco de reversão comentado no fim.

### 2. Migrar as vendas existentes

```sql
select public.migrate_legacy_sales(false);   -- relatório, sem gravar
select public.migrate_legacy_sales(true);    -- grava
```

A simulação lista as cinco vendas atuais com o corretor, o percentual e o
regime de imposto que a função detectou. Confira antes de gravar. Os valores
são **copiados** do razão, nunca recalculados.

O relatório traz um campo `divergencias`: parcelas cujo valor gravado difere do
que a regra de hoje calcularia. Hoje há uma — a 414-D parcela 1, paga com
R$ 10.000,00 quando a regra daria R$ 10.087,46, por causa de um desconto
combinado. O valor gravado é mantido porque é o que aconteceu.

### 3. Conferir

```bash
npm run auditoria-imob
```

### 4. Publicar

```bash
git checkout main && git merge reestruturacao-imobiliaria && git push
```

A Vercel publica sozinha a partir do `main`. **Antes desse merge o sistema novo
não vai ao ar**, e é de propósito: o app antigo continua funcionando enquanto as
migrações não estiverem aplicadas, porque elas são aditivas.

### 5. Dar acesso a um corretor

1. Supabase → Authentication → Users → **Invite user** com o e-mail dele.
2. Ele recebe o convite e cria a senha.
3. No app: Corretores → **Acessos** → ligar o login ao corretor.

Criar usuário exige chave de administração, que não pode ficar no navegador —
por isso o convite sai do painel. O e-mail de convite usa o SMTP do Supabase,
que tem limite baixo de envios por hora; para uso real vale configurar SMTP
próprio (a Brevo já está no ecossistema).

### 6. Arquivar o que saiu do escopo (depois, sem pressa)

```sql
select public.archive_out_of_scope(false);  -- relatório
select public.archive_out_of_scope(true);   -- copia para o schema `arquivo`
```

Copia o razão pessoal (660 lançamentos), a Souza Assessoria (8), as contas e o
patrimônio pessoais para o schema `arquivo`, que a API não expõe, e marca as
empresas como arquivadas. **Nada é apagado.** A exclusão tem função separada
(`purge_archived`) que exige a frase `apagar dados fora do escopo` digitada, e
não deve ser executada antes de exportar o arquivo para fora do banco.

---

## Como o dinheiro é calculado

A ordem importa e vive em um lugar só, na função `receive_installment`
(migração 009):

```
parcela da comissão
− ISS retido na fonte        (quando a construtora retém; Lotisa retém 3%)
− Simples sobre o líquido    (quando há nota fiscal; 6%)
= base
− comissão do corretor       (% × base, nunca sobre o bruto)
− fatia do sócio             (quando houver)
= fica para a imobiliária
```

Aplicar o percentual do corretor sobre o valor bruto paga o parceiro a mais.
Numa venda isso já custou R$ 1.327,59. O formulário do sistema antigo calculava
exatamente assim; por isso a conta foi para o banco, onde app, script e agente
não podem discordar.

**Situação da comissão, no vocabulário do corretor:**

| Situação | Significado |
| --- | --- |
| prevista | a imobiliária ainda não recebeu essa parcela |
| liberada | a imobiliária recebeu; a comissão está a pagar |
| recebida | já foi paga ao corretor |

O corretor vê a base do cálculo (parcela menos impostos) para conferir o
próprio número. Não vê o líquido da imobiliária, despesas, nem nada de outro
corretor — e isso é garantido no banco, não na tela.

---

## Arquitetura

```
src/
  app/ …            App.tsx decide qual aplicativo carrega, pelo papel do perfil
  auth/             sessão + perfil + papel, login, recuperação de senha
  admin/            contexto, casca e telas do administrador
  corretor/         contexto, casca e telas do corretor
  lib/sales.ts      leitura da venda para a tela (soma e classifica, não recalcula)
  lib/finance.ts    DRE e KPIs (reaproveitado)
  components/ui/    kit de interface (reaproveitado)
supabase/migrations/  000_base … 012_arquivo
scripts/              backup, verificação, restauração, testes, auditoria
```

**O razão (`transactions`) continua sendo a verdade contábil.** DRE, caixa,
extrato e previsão leem de lá. A venda é a verdade operacional, ligada ao razão
por chave (`sale_id`, `sale_installment_id`), nunca por texto da descrição —
vínculo por texto já fez um lançamento sumir de um relatório sem erro nenhum.

**Escrita de venda só por função do banco.** Registrar uma venda cria de 4 a 20
linhas; o supabase-js não faz transação entre tabelas, e meia venda gravada é
pior que nenhuma.

---

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | roda local |
| `npm run typecheck` | verifica os tipos (use este, não `build`) |
| `npm run backup` | copia todo o banco para `~/Documents/souza-financeiro-backup-<data>` |
| `npm run verifica-backup -- <pasta>` | confere o backup contra o banco (contagem, somas, SHA-256, chaves) |
| `npm run teste-restauracao -- <pasta>` | recria o banco do zero num Postgres local e compara |
| `npm run teste-sistema -- <pasta>` | aplica as 12 migrações sobre os dados reais do backup e exercita tudo |
| `npm run restaura-backup -- <pasta>` | restaura um backup (simulação por padrão) |
| `npm run auditoria-imob` | audita os invariantes da imobiliária em produção |

`teste-sistema` é o que dá confiança para colar SQL num banco com dados reais:
sobe um Postgres de verdade (PGlite, em WASM, sem Docker e sem rede), aplica as
migrações sobre o backup, migra as vendas, registra uma venda nova, recebe com
ISS retido, paga comissão com desconto, reagenda, desfaz, cancela, e troca de
papel para provar que o corretor não lê tabela nenhuma.

**Não rode `npm run build` nesta máquina** — trava por I/O da pasta sincronizada.
O build de produção é feito pela Vercel.

---

## Decisões implementadas (e as que faltam)

Implementado conforme o plano de reestruturação:

- Corretor vê a base do cálculo, não o líquido da imobiliária.
- Comissão liberada no dia em que a parcela é recebida.
- Rafael entra como contato corretor (`is_owner`), substituindo a constante com
  o nome dele que estava fixa no código.
- Cancelamento cancela só o que ainda não aconteceu; imposto de parcela já
  recebida continua devido.
- Reagendamento guarda a data anterior na nota.
- ISS retido e Simples parametrizados por empreendimento e por venda.
- Parceria registra só a parte da Souza, com o VGV cheio.
- Sem chave caixa/competência global: ela existe só dentro de Relatórios.
- Desconto na comissão tem campo próprio (`broker_adjustment`) e aparece para o
  corretor como "desconto combinado".

Ainda dependem de decisão:

- **Divisão de uma venda entre dois corretores.** O modelo reserva espaço, mas
  não está implementado.
- **VGV e percentual do Itajaí Urban Club**, que a venda atual não tem gravados.
- **Origem das duas despesas com contraparte "Dionata"** (R$ 305,00) e do
  desconto de R$ 399,44 na 414-D.
- **Distribuição de lucro por venda.** Não existe nos dados hoje e não foi
  recriada; o campo está no schema, desativado.
- **Futuro do financeiro pessoal.** Saiu deste sistema; se for para continuar,
  é projeto separado.
