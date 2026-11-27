# Entrega do projeto — Professor Douglas

Repositório do grupo: **https://github.com/Gaabllez/bilheteria-api**.

Vídeo publicado: **[Assistir à apresentação](https://youtu.be/PAbFfoOZ0Is?is=VjZeK27Q1f91e-Pz)**. O link já consta no início do README; este guia não confirma a reprodução, o acesso sem login ou o conteúdo da gravação.

Este guia segue os requisitos do enunciado de **Bilheteria concorrente**, projeto final de Paradigmas de Linguagens de Programação. A correção considera o último commit do repositório até o prazo. A data exata deve ser consultada na atividade da turma no Blackboard; ela não foi informada no PDF.

## Valor do trabalho

| Critério | Valor máximo | Evidência exigida |
|---|---:|---|
| Código | 2,50 | Testes originais: `2,5 × pontos do npm test ÷ 16` |
| Vídeo, partes 1, 2 e 8 | 0,25 | Integrantes, projeto funcionando, rotas e benchmark |
| Vídeo, partes 3, 4 e 7 | 0,25 | Explicação de OO, programação funcional e servidor, com os motivos das escolhas |
| Vídeo, partes 5 e 6 | 0,25 | Concorrência, demonstração proposital do erro e reversão |
| README completo | 0,25 | Integrantes, perguntas respondidas e tabela real do benchmark |
| **Total** | **3,50** | Cumprimento técnico e das etapas de entrega |

Os **16 pontos dos testes equivalem a 2,5 pontos de código**, não aos 3,5 pontos completos. Os testes são necessários, mas não comprovam a gravação, a explicação oral ou o envio. A interface e o catálogo são complementos; não têm uma pontuação separada na rubrica fornecida.

## Situação do repositório

O código mantém três eventos, de IDs **1, 2 e 3**, na API original (`/eventos` e `/reservas`), com o evento 1 começando com 100 poltronas. O catálogo do site contém **14 eventos reserváveis em simulação**: 12 artistas/turnês e dois espetáculos teatrais. A interface usa `/catalogo/eventos` e `/catalogo/reservas`, com estoque independente do estoque da API original. Preços, reservas e pagamentos são demonstrativos, sem venda real de ingressos.

O arquivo [src/aplicacao.ts](../src/aplicacao.ts) compõe as duas APIs e os arquivos de `public/`, e é usado tanto pelo servidor principal quanto pelas verificações HTTP e de interface. Ele trata erros de transporte com **400** para JSON inválido ou corpo incompleto, **413** para JSON acima de 100 KB e **415** para codificação não suportada, preservando os arquivos originais do professor.

As decisões solicitadas pelo README e a tabela de benchmark estão preenchidas. O [relatório de validação](../VALIDACAO.md) e o [GitHub Actions](https://github.com/Gaabllez/bilheteria-api/actions) registram resultados por revisão; confira a execução do commit que será entregue.

O [roteiro do vídeo](ROTEIRO_VIDEO.md) reúne as oito partes obrigatórias e os comandos de demonstração para conferir a apresentação publicada e preparar eventuais atualizações.

## Itens que o grupo precisa concluir

### Participação e colaboradores

| Integrante | RGM | Conta identificada | Situação a conferir |
|---|---|---|---|
| Gabriel Galvão Fredrich | 33632308 | `Gaabllez` | Commits identificados no histórico; revisar a descrição da participação no README |
| Inácio Assis dos Santos Netto | 32830980 | `nettoinacio` | Commits de catálogo teatral, filtros, validação, documentação e testes identificados; confirmar que o resumo corresponde ao trabalho realizado |
| Marcus Vinícius Souza Fernandes Filho | 33204128 | `Mvsff` | Commits identificados no histórico; revisar a descrição da participação no README |
| Rafael Olívio Ribeiro Campos | 34289461 | `rafaeloliviooo` | Commits de expansão do catálogo, arte editorial, interface, README e testes identificados; confirmar que o resumo corresponde ao trabalho realizado |

O enunciado pede que os colegas sejam colaboradores e que **cada integrante faça commits com a própria conta**. Ele determina **zero no projeto inteiro, código e vídeo, para quem não tiver commit próprio**. Não atribua commits a outra pessoa para preencher o requisito: cada um deve realizar e registrar sua contribuição real.

Para conferir os registros, consulte o [histórico no GitHub](https://github.com/Gaabllez/bilheteria-api/commits/main/) e, localmente:

```bash
git log --all --format="%h | %an | %s"
```

O nome de autor do Git, isoladamente, não comprova a associação a uma conta. Abra os commits no GitHub e confira a conta vinculada. As contribuições que valerão para a entrega precisam estar na versão entregue até o prazo, não apenas numa branch que ficou sem integração.

### Conferência do vídeo publicado

O [link publicado](https://youtu.be/PAbFfoOZ0Is?is=VjZeK27Q1f91e-Pz) já está registrado. Os itens abaixo são critérios para o grupo conferir na gravação, sem presumir que estejam ausentes ou já verificados:

- [ ] Confirmar que a abertura identifica os integrantes e suas contribuições reais; basta um integrante falar pelo grupo.
- [ ] Conferir que o vídeo mostra a versão do código que será entregue e começa com `git log -1` na tela.
- [ ] Conferir a legibilidade do código durante a explicação; slides ou leitura de um texto pronto não substituem a explicação do código.
- [ ] Conferir as oito partes do [roteiro](ROTEIRO_VIDEO.md), na ordem do professor.
- [ ] Conferir a alteração que causa o erro de concorrência, a execução dos testes, a explicação da falha e a reversão da alteração.
- [ ] Conferir os testes corretos depois da reversão e o benchmark com o servidor reiniciado.
- [ ] Conferir que a publicação atende ao acesso exigido: YouTube não listado ou Drive para qualquer pessoa com o link.
- [ ] Abrir o link do vídeo sem login em uma janela anônima.
- [ ] Se houver atualização da gravação, manter o mesmo link atualizado no README e no texto de envio abaixo.

Um vídeo com link inacessível não atende à entrega. O enunciado informa que um link de vídeo que não abre vale zero nessa parte.

### Conferência final e Blackboard

- [ ] Confirmar que o repositório está público e abre numa janela anônima.
- [ ] Conferir que todos os integrantes estão corretamente listados com nome completo, RGM, conta e contribuição real.
- [ ] Conferir colaboradores e commits individuais vinculados às próprias contas.
- [ ] Confirmar que a alteração proposital do vídeo foi desfeita e não foi publicada.
- [ ] Conferir testes e demais evidências da versão final, preservando os arquivos originais do professor.
- [ ] Confirmar nome do grupo e data/horário do prazo na atividade da turma.
- [ ] Preencher o nome do grupo no texto abaixo e enviar pelo Blackboard.
- [ ] Conferir que a plataforma registrou o envio e guardar o comprovante exibido.

## Texto para o Blackboard

Um integrante faz o envio pelo grupo. Copie o texto abaixo **depois de substituir o nome do grupo entre colchetes**. O link do vídeo já está preenchido; confira seu acesso antes de enviar.

```text
Projeto final — Bilheteria concorrente
Disciplina: Paradigmas de Linguagens de Programação

Nome do grupo: [PREENCHER COM O NOME CADASTRADO NA TURMA]

Repositório: https://github.com/Gaabllez/bilheteria-api
Vídeo: https://youtu.be/PAbFfoOZ0Is?is=VjZeK27Q1f91e-Pz

Integrantes:
Gabriel Galvão Fredrich — RGM 33632308
Inácio Assis dos Santos Netto — RGM 32830980
Marcus Vinícius Souza Fernandes Filho — RGM 33204128
Rafael Olívio Ribeiro Campos — RGM 34289461
```

## O que ainda não está comprovado

O vídeo já tem link publicado e registrado no README. A revisão do código e deste guia não verificou a reprodução, o acesso sem login ou o cumprimento das oito partes na gravação. O nome cadastrado do grupo, o prazo exato da turma e o comprovante de envio ao Blackboard ainda precisam ser confirmados pelo grupo. As contas e os commits de Inácio (`nettoinacio`) e Rafael (`rafaeloliviooo`) estão identificados no histórico; o grupo deve confirmar que as descrições de contribuição refletem o trabalho efetivamente realizado. A entrega somente fica concluída após as conferências exigidas e o envio registrado no Blackboard.
