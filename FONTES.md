# Artistas, turnês e fotografias

Catálogo editorial conferido em **26/11/2026**. Os nomes das turnês são reais; preços, capacidades, poltronas, reservas e pagamentos deste projeto são apenas demonstrações acadêmicas. Este catálogo não representa uma agenda de apresentações futuras nem disponibilidade de ingressos reais.

## Seleção e fontes oficiais

| Artista | Turnê | Referência editorial | Agenda oficial |
|---|---|---|---|
| Lady Gaga | The MAYHEM Ball | 2025–2026 | [Consultar](https://www.ladygaga.com/us-en/live/) |
| Bruno Mars | The Romantic Tour | Edição 2026 | [Consultar](https://www.brunomars.com/theromantictour) |
| The Weeknd | After Hours Til Dawn | Edição 2026 | [Consultar](https://www.theweeknd.com/tour/) |
| Coldplay | Music Of The Spheres World Tour | Turnê iniciada em 2022 | [Consultar](https://www.coldplay.com/tour/) |
| Shakira | Las Mujeres Ya No Lloran World Tour | Registros de 2026 | [Consultar](https://www.shakira.com/tour-hub/) |
| Linkin Park | From Zero World Tour | 2024–2026 | [Consultar](https://www.linkinpark.com/tour) |

Os links de agenda são o caminho para consultar datas e ingressos reais. Não foram inventados locais, datas futuras ou vínculos comerciais. Os períodos da tabela identificam a edição pesquisada; não garantem que a turnê esteja ativa na data em que o site é usado.

### Registros usados para a curadoria

- **Lady Gaga:** Esta seleção apresenta a edição 2025–2026. As datas consultadas já passaram; veja a agenda oficial para atualizações. [Fonte de referência](https://news.livenationentertainment.com/news/lady-gaga-mayhem-ball-tour-2026).
- **Bruno Mars:** A edição de 2026 foi anunciada em estádios. Consulte a agenda oficial para acompanhar novas datas e informações. [Fonte de referência](https://news.livenationentertainment.com/news/bruno-mars-announces-the-romantic-tour-first-global-headline-tour-in-nearly-a-decade-and-first-global-stadium-outing).
- **The Weeknd:** As datas brasileiras de 2026 consultadas já passaram. A agenda oficial não exibia próximos eventos na data da pesquisa. [Fonte de referência](https://www.universalmusic.com.br/2025/09/05/the-weeknd-anuncia-a-turne-after-hours-til-dawn-no-brasil-em-2026-com-participacao-de-anitta/).
- **Coldplay:** Turnê anunciada com início em 2022. A agenda oficial não exibia novas datas na data da pesquisa. [Fonte de referência](https://www.coldplay.com/music-of-the-spheres-world-tour-announced/).
- **Shakira:** O hub oficial reúne registros da turnê em 2026. Consulte a agenda oficial para informações sobre novas apresentações. [Fonte de referência](https://www.shakira.com/tour-hub/).
- **Linkin Park:** A seleção apresenta a fase 2024–2026. A agenda oficial não exibia próximos shows na data da pesquisa. [Fonte de referência](https://news.livenationentertainment.com/news/linkin-park-roar-into-2025-with-50-new-shows-on-from-zero-world-tour).

## Fotografias reais e contexto

As fotografias ficam em `public/images/artists/` e são servidas pelo próprio projeto, sem dependência de hotlinks. São oito arquivos WebP, com **850.490 bytes no total**. Os cards usam imagens de até 800 px de largura, e os destaques usam 1600 × 900 px. As fotos têm dimensões declaradas e carregamento adiado quando apropriado.

Autoria, origem, licença, alterações e contexto de cada fotografia estão em [CREDITS.md](public/images/artists/CREDITS.md) e [credits.json](public/images/artists/credits.json). As adaptações das imagens com licença CC BY-SA mantêm a respectiva licença. Os créditos podem ser abertos pelo rodapé, e os detalhes da turnê mostram o crédito e o contexto da foto do artista.

As fotos de Bruno Mars (2024) e The Weeknd (2018) são de arquivo e não retratam as turnês citadas nos respectivos cards. O Coldplay aparece no Glastonbury de 2024 no card e em Hong Kong, em 2025, no destaque. A imagem do Linkin Park é promocional, da formação de 2024. Os textos alternativos e créditos identificam esses contextos. Nenhuma fotografia foi gerada por IA.

## Manutenção do catálogo

`public/catalogo.json` concentra nomes, turnês, estilos, descrições, fontes, fotos, créditos e parâmetros fictícios de reserva. `src/catalogo.ts` lê essa fonte para criar os eventos da API. O navegador lê o mesmo arquivo e confere nome, ID, preço e capacidade antes de habilitar as reservas.

Ao atualizar a seleção, confira as fontes oficiais, atualize `verifiedAt`, revise os créditos das imagens e reinicie a API. O evento de ID 1 deve manter 100 poltronas e preço fictício de R$ 100 para preservar o contrato do benchmark. A interface recusa inconsistências entre metadados e API e permite repetir o carregamento pelo botão Atualizar.

## Espetáculos teatrais adicionados em 26/11/2026

- **O Fantasma da Ópera:** a página oficial de origem de Londres identifica a produção original como estabelecida em 1986. O catálogo registra “Desde 1986 (Londres)” como referência histórica, não como calendário de apresentações. [Fonte oficial](https://www.phantomoftheopera.com/london/about).
- **Wicked:** o guia oficial registra a abertura na Broadway em 2003. O catálogo registra “Desde 2003 (Broadway)” como referência histórica, não como disponibilidade atual. [Guia oficial](https://wickedthemusical.com/wp-content/uploads/2025/04/Wicked-Study-Guide-Large-File-Sile.pdf).

Ambos são registros editoriais não reserváveis. Os valores e capacidades fictícios presentes no JSON são dados técnicos internos do catálogo; a interface não os exibe como preços nem permite checkout para esses registros.
