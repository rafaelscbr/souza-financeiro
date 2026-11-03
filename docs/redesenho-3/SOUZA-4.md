# Souza 4.0: o padrão do Souza Academy

*02/11/2026 · pedido do Rafael: "Desginer parecido com esse em anexo, porém mais bonito… quero que faça Souza Financeiro e o financeiro com esse italico amarelo, até pra gente ter um padrão de sistemas".*

Os valores foram copiados de `~/Documents/Souza Academy/src/app/globals.css` e `marca/README.md`, para os dois sistemas ficarem iguais. A estrutura de cada tela continua a do Souza 3.0 (GUIA-DE-TELA.md). Mudou a pele, e o Início ganhou o destaque.

## Fundação

- **Letras:** Schibsted Grotesk (títulos em 800) e Instrument Serif itálico só na ênfase: o "Financeiro" da marca e o nome na saudação.
- **Moldura e folha:**
  - No computador, a moldura é marinho `#0F1730` e o menu fica nela, como no Academy. O item ativo tem véu branco, ícone areia e filete areia.
  - A página é uma folha branca com cantos de 24px.
- **Marca:** `MarcaFinanceiro` = símbolo em traço + "Souza" (800) + "Financeiro." (Instrument Serif itálico).
  - Sobre marinho: branco e areia `#E4B23C`.
  - No claro: marinho e ouro `#AD7F22`.
- **Painéis e cartões:**
  - Painel de números (`FaixaDeMetricas`): creme `#F6F3EC`, rótulos em caixa alta espaçada.
  - Cartões: brancos, cantos de 20, fio leve.
- **Botões:**
  - O principal é marinho.
  - O de criar ("Novo lançamento") é areia com tinta marinho, como o "Criar" do CRM.
  - O secundário é branco com fio.
- **Título de cada tela:**
  - Sobretítulo dourado em caixa alta, que diz a área (`sobretituloDe` em navegacao.ts).
  - Título 800 com 40px.
  - Frase de 17px embaixo.
- **Destaque (`CartaoDestaque`):** o cartão marinho do Academy com a luz azul do herói do CRM e o anel areia que se fecha ao abrir.
  - No Início do administrador: saldo de hoje, anel de quanto da comissão do mês já entrou, e a receber, a pagar e o resultado.
  - No Início do corretor: o liberado para ele, anel de quanto do ano já caiu, e o recebido, o previsto e as vendas.
- **Destaque nas telas principais (`FaixaEmDestaque`):** as mesmas métricas da faixa, em cartão marinho com anel.
  - **A receber:** o previsto, com o anel de quanto está em atraso.
  - **A pagar:** o devido agora, com o anel de quanto já venceu.
  - **Vendas:** a carteira, com o anel de quanto da comissão contratada já entrou.
- **Saudação no Início:** "Boa noite, *Rafael*", como no CRM.
- **Números proporcionais:** o "tnum" da Schibsted alargava vírgula e ponto.

## O que o inspetor de design aponta e ficou de propósito

O italic serif no título, o sobretítulo em caixa alta, a luz azul no cartão e o título grande são o padrão da casa (Academy e CRM), pedido pelo Rafael.

## Ícone "Sf" (02/11/2026)

É da mesma família do "Sa" do Academy: quadrado marinho `#0F1730` com cantos de 22%, o "S" branco em Schibsted Grotesk 800 e o "f" em Instrument Serif itálico areia `#E4B23C`. As letras foram convertidas em desenho a partir dos arquivos das fontes no Google Fonts, então funcionam sem nenhuma fonte instalada.

| Arquivo | Uso |
| --- | --- |
| `public/favicon.svg` | Aba do navegador. O "f" tem um traço a mais, para ler em 16px. |
| `public/favicon-32.png` | Navegador sem suporte a SVG. |
| `public/apple-touch-icon.png` | Tela de início do iPhone. O fundo vai até a borda, e o iOS arredonda. |
| `public/pwa-192.png` e `public/pwa-512.png` | App instalado. |
| `public/pwa-maskable-512.png` e `public/icon-maskable.svg` | Android. O fundo vai até a borda e o "Sf" fica na zona segura. |

O manifesto do app agora traz o nome "Souza Financeiro" e as cores em marinho.
