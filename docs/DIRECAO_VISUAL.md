# Direção visual e textos da bilheteria

Revisão de **26/11/2026**, solicitada para retirar o traço antes do texto da abertura e aproximar a interface do universo pop.

## Direção aplicada

A interface mantém a identidade preta e verde-lima e usa hierarquia de cartaz: títulos condensados, nomes dos artistas maiores, fotografia em destaque e ações curtas. O rosa aparece pontualmente na abertura. Formulários, preços, taxas e avisos continuam com tipografia de leitura.

- Remoção do elemento `kicker-line` e da regra que desenhava a barra na abertura.
- Título “Do fone pra grade.” e texto de apoio com artistas presentes no catálogo.
- Revisão das chamadas do site: “Quem você quer ver?”, “Monte sua reserva” e “Resumo da reserva”.
- Descrições próprias para os 14 eventos, com referências ao som, à turnê ou ao musical, substituindo fórmulas repetidas.
- Rótulos “Turnê” e “Musical”, com ações “Ver show” e “Ver peça”.
- Separadores visíveis com ponto central na seleção e no comprovante; os nomes retornados pela API preservam o contrato anterior.
- Faixa de artistas com contraste forte, títulos em Barlow Condensed e textos menores ampliados nos breakpoints existentes.

As fotos, créditos, fontes das turnês, datas, IDs, preços fictícios e capacidades foram preservados. Os 14 eventos continuam disponíveis para simulação, e a API original mantém seus três eventos e estoque independente.

## Referências consultadas

As referências servem como ponto de partida para decisões próprias de composição e linguagem. Não foram copiadas artes, logotipos, fontes proprietárias ou textos de campanhas.

| Referência oficial | Uso como referência |
|---|---|
| [Lady Gaga: The MAYHEM Ball](https://www.ladygaga.com/us-en/shop/collections/the-mayhem-ball) | Fotografia como elemento principal e hierarquia curta entre artista, turnê e ação |
| [Dua Lipa: pôster oficial da turnê](https://usshop.dualipa.com/products/photo-poster) | Relação entre foto, tipografia expressiva e identidade de turnê |
| [Rock in Rio](https://rockinrio.com/rio/pt-br/home/) | Escala de cartaz, contraste e linguagem voltada a quem vai a shows |

Essas aplicações são interpretações de design para o projeto; não indicam parceria ou endosso dos artistas e festivais.

## Fonte de exibição

Foi incluída uma cópia local de **Barlow Condensed ExtraBold**, de The Barlow Project Authors, distribuída sob **SIL Open Font License 1.1**. A fonte fica em `public/fonts/barlow-condensed-800.ttf`; sua licença completa acompanha o arquivo em [OFL-barlow-condensed.txt](../public/fonts/OFL-barlow-condensed.txt).

Origem: [google/fonts, ofl/barlowcondensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed). O TTF foi preservado sem modificação; seu hash de blob Git é `d5a6c7505459f142b20d65d3579e1b840462b75f`. Ele é servido pela própria aplicação e não depende do carregamento do Google Fonts. As famílias já utilizadas nos textos e controles foram mantidas, com suas alternativas locais.

## Verificação

As verificações existentes de interface cobrem reservas nos 14 eventos, filtros, erros, impressão e larguras de 360, 390 e 768 px. A revisão visual também usa as capturas de desktop e celular geradas pelo GitHub Actions. Os resultados de cada versão podem ser consultados no [histórico de execuções](https://github.com/Gaabllez/bilheteria-api/actions).
