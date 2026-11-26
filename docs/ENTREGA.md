# Entrega do projeto — Professor Douglas

Repositório do grupo: **https://github.com/Gaabllez/bilheteria-api**.

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

O código foi organizado para manter três eventos na API, com o evento 1 começando com 100 poltronas. Os seis artistas permanecem no catálogo do site; três são exclusivamente editoriais. As decisões solicitadas pelo README e a tabela de benchmark estão preenchidas. O [relatório de validação](../VALIDACAO.md) e o [GitHub Actions](https://github.com/Gaabllez/bilheteria-api/actions) registram resultados por revisão; confira a execução do commit que será entregue.

O [roteiro do vídeo](ROTEIRO_VIDEO.md) está preparado com as oito partes obrigatórias e comandos de demonstração. Ele é material de preparação, não um vídeo já gravado.

## Itens que o grupo precisa concluir

### Participação e colaboradores

| Integrante | RGM | Conta identificada | Situação a conferir |
|---|---|---|---|
| Gabriel Galvão Fredrich | 33632308 | `Gaabllez` | Commits identificados no histórico; revisar a descrição da participação no README |
| Inácio Assis dos Santos Netto | 32830980 | A confirmar | Informar conta, contribuição real e commit próprio no repositório |
| Marcus Vinícius Souza Fernandes Filho | 33204128 | `Mvsff` | Commits identificados no histórico; revisar a descrição da participação no README |
| Rafael Olívio Ribeiro Campos | 34289461 | A confirmar | Informar conta, contribuição real e commit próprio no repositório |

O enunciado pede que os colegas sejam colaboradores e que **cada integrante faça commits com a própria conta**. Ele determina **zero no projeto inteiro, código e vídeo, para quem não tiver commit próprio**. Não atribua commits a outra pessoa para preencher o requisito: cada um deve realizar e registrar sua contribuição real.

Para conferir os registros, consulte o [histórico no GitHub](https://github.com/Gaabllez/bilheteria-api/commits/main/) e, localmente:

```bash
git log --all --format="%h | %an | %s"
```

O nome de autor do Git, isoladamente, não comprova a associação a uma conta. Abra os commits no GitHub e confira a conta vinculada. As contribuições que valerão para a entrega precisam estar na versão entregue até o prazo, não apenas numa branch que ficou sem integração.

### Vídeo

- [ ] Escolher o integrante que apresentará; basta um falar pelo grupo.
- [ ] Confirmar as contribuições antes de apresentá-las na abertura.
- [ ] Gravar a versão do código que será entregue, começando com `git log -1` na tela.
- [ ] Mostrar código legível enquanto explica; não substituir por slides ou leitura de um texto pronto.
- [ ] Cobrir as oito partes do [roteiro](ROTEIRO_VIDEO.md), na ordem do professor.
- [ ] Mostrar a alteração que causa o erro de concorrência, executar os testes, explicar a falha e desfazer a alteração.
- [ ] Mostrar os testes corretos novamente e executar o benchmark com o servidor reiniciado.
- [ ] Publicar no YouTube não listado ou no Drive com acesso para qualquer pessoa com o link.
- [ ] Conferir que o vídeo abre sem login em uma janela anônima.
- [ ] Substituir a indicação pendente no início do README pelo link verdadeiro e registrar a atualização no repositório.

Um vídeo com link inacessível não atende à entrega. O enunciado informa que um link de vídeo que não abre vale zero nessa parte.

### Conferência final e Blackboard

- [ ] Confirmar que o repositório está público e abre numa janela anônima.
- [ ] Conferir que todos os integrantes estão corretamente listados com nome completo, RGM, conta e contribuição real.
- [ ] Conferir colaboradores e commits individuais vinculados às próprias contas.
- [ ] Confirmar que a alteração proposital do vídeo foi desfeita e não foi publicada.
- [ ] Conferir testes e demais evidências da versão final, preservando os arquivos originais do professor.
- [ ] Confirmar nome do grupo e data/horário do prazo na atividade da turma.
- [ ] Preencher os dois campos pendentes no texto abaixo e enviar pelo Blackboard.
- [ ] Conferir que a plataforma registrou o envio e guardar o comprovante exibido.

## Texto para o Blackboard

Um integrante faz o envio pelo grupo. Copie o texto abaixo **depois de substituir os dois campos entre colchetes**. Não envie um campo pendente como se fosse informação concluída.

```text
Projeto final — Bilheteria concorrente
Disciplina: Paradigmas de Linguagens de Programação

Nome do grupo: [PREENCHER COM O NOME CADASTRADO NA TURMA]

Repositório: https://github.com/Gaabllez/bilheteria-api
Vídeo: [PREENCHER COM O LINK PUBLICADO E TESTADO SEM LOGIN]

Integrantes:
Gabriel Galvão Fredrich — RGM 33632308
Inácio Assis dos Santos Netto — RGM 32830980
Marcus Vinícius Souza Fernandes Filho — RGM 33204128
Rafael Olívio Ribeiro Campos — RGM 34289461
```

## O que ainda não está comprovado

Até a preparação deste material, não há link de vídeo publicado, confirmação das contas e contribuições de Inácio e Rafael, nome cadastrado do grupo, prazo exato da turma ou comprovante de envio ao Blackboard disponíveis neste repositório. Esses dados precisam ser fornecidos e conferidos pelo grupo; não foram inventados para marcar a entrega como concluída.
