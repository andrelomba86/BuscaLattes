import fs from 'fs'
import path from 'path'
import { parse } from 'node-html-parser'
import { createObjectCsvWriter } from 'csv-writer'
import { count } from 'console'
import { resolveAny } from 'dns'
import { start } from 'repl'

const startingYear = 2024
const endingYear = 2024

// Função utilitária para limpar texto
function cleanText(text) {
  if (!text) return ''
  return text
    .replace(/[\n\s]+/g, ' ') // Replace multiple spaces with a single space
    .trim()
}

// Nova função para remover tags HTML
function stripHTML(text) {
  if (!text) return ''

  return cleanText(text)
    .replace(/<\/?[^>]+(>|$)/g, '')
    .trim()
}

function getNthNextElement(element, n) {
  let next = element
  for (let i = 0; i < n; i++) {
    if (next.nextElementSibling) {
      next = next.nextElementSibling
    } else {
      return null // Se não houver mais elementos, retorna null
    }
  }
  return next
}
// Função para extrair artigos completos
function extractArticles(researcherName, root, filename) {
  const articles = []
  const articlesSection = root.querySelectorAll('.artigo-completo')
  let countErrors = 0

  // articlesSection.forEach(article => {
  for (let article of articlesSection) {
    const year = article.querySelector('[data-tipo-ordenacao="ano"]').innerHTML
    const author = article.querySelector('[data-tipo-ordenacao="autor"]').innerHTML

    // const doiURL = article.querySelector('[class="icone-producao icone-doi"]')
    const doi = article.querySelector('.icone-doi')?._attrs.href

    if (year < startingYear || year > endingYear) continue
    //                                               v -este ponto tem que estar entre espaços
    // <SOBRENOME, N.;SOBRENOME2, N2.; SOBRENOME,N3. . ARTIGO ....
    const textArray = cleanText(article.text)
      .match(/\d{4}?(.+)/)[1]
      .split(' . ')

    if (textArray.length === 1) {
      console.log('[ARTIGOS] Não foi possível separar o(s) autore(s)')
      console.log(`Lattes: ${researcherName} | Arquivo: ${filename}`)
      console.log(`Linha: ${article.text}`)
      console.log('-'.repeat(70))
      countErrors += 1
    }
    const authors = textArray[0]
    const title = textArray[1]
    let doiMatch = []
    if (title) doiMatch = title.match(/doi\.org\/(.*?)\s/)

    articles.push({
      year,
      researcher: researcherName,
      author,
      authors,
      title,
      doi,
    })
  }
  if (countErrors) {
    console.log(`Problemas encontrados: ${countErrors}`)
    process.exit()
  }
  return articles
}

// Função para extrair projetos de pesquisa
function extractProjects(researcherName, root, filename) {
  const projects = []
  const projectsSection = root
    .querySelector('div:has(> a[name=ProjetosPesquisa])')
    .querySelectorAll('[name^="PP_"]')

  //projectsSection.forEach(project => {
  for (let project of projectsSection) {
    let nextElement = getNthNextElement(project, 1)
    let [init, end] = nextElement.querySelector('b').innerHTML.split(' - ')
    init = Number(init)
    end = end == 'Atual' ? new Date().getFullYear() : Number(end)

    if (startingYear < init && endingYear < init) continue
    if (startingYear > end) continue

    // if (startYear < startingYear) continue

    nextElement = getNthNextElement(project, 2)

    let title = nextElement.querySelector('.layout-cell-pad-5')
    const brHTML = title.querySelector('br')
    title = title.removeChild(brHTML).innerHTML.trim()

    //nextElement = getNthNextElement(project, 3)

    // Extrai informações de coordenador e integrantes
    nextElement = getNthNextElement(project, 4)
    const description = cleanText(nextElement.innerHTML)
    const funders = description.match(/Financiador\(es\):\s(.+)\.*<?/)?.[1] || ''
    // console.log(financiadores)
    const membersMatch = description.match(/Integrantes:\s([^<]+)/i)
    const membersArray = membersMatch ? membersMatch[1].split(' / ') : []
    const members = membersArray.map(m => m.replace(/\s\-\s(Integrante|Coordenador)\.?/, '')).join(', ')
    const coordinator = membersArray
      .find(m => m.includes('Coordenador'))
      ?.replace(/\s*\-\s*Coordenador\.?/i, '')

    // if (!coordinator) {
    //   console.log('[Erro]: coordenador não encontrado')
    //   console.log(`Lattes: ${researcherName} / Arquivo: ${filename}`)
    //   console.log(`\nLinha: ${project}`)
    //   process.exit(1)
    // }

    if (end) {
      projects.push({
        researcher: researcherName,
        title: cleanText(title),
        startYear: init,
        endYear: end,
        coordinator: coordinator,
        members: members,
        funders,
      })
    } else {
      console.log('[Erro]: ano de projeto não encontrado')
      console.log(`\tLinha: ${project}`)
    }
  }
  return projects
}

// Função para extrair participação em bancas
function extractParticipationInExamBoards(researcherName, root, filename) {
  const types = {
    Mestrado: 'Mestrado',
    'Teses de doutorado': 'Doutorado',
    'Qualificações de Mestrado': 'Qualificação de Mestrado',
    'Qualificações de Doutorado': 'Qualificação de Doutorado',
    'Trabalhos de conclusão de curso de graduação': 'TCC',
  }
  const participations = []
  let currentType, year
  const participationSection = root.querySelector('[name="ParticipacaoBancasTrabalho"]').parentNode
  for (let element of participationSection.children) {
    if (element.rawAttrs.trim() === 'class="cita-artigos"') {
      const type = element.children[0].innerHTML
      currentType = types[type] ?? 'Outros'
    } else if (element.rawAttrs.trim() === 'class="layout-cell layout-cell-11"') {
      const description = stripHTML(element.innerHTML)
      year = description.match(/\.\s(\d{4})/)[1]
      if (!year) {
        console.log('[ERRO] Ano não encontrado')
        console.log(researcherName, 'Arquivo:', filename)
        process.exit()
      }
      if (year < startingYear || year > endingYear) continue

      participations.push({
        year,
        researcher: researcherName,
        type: currentType,
        description,
      })
    }
  }
  return participations
}

// Função para extrair participação em comissões
function extractCommittees(researcherName, root) {
  const committees = []
  const activitiesSection = root.querySelectorAll('.layout-cell-11')

  activitiesSection.forEach(activity => {
    const text = activity.text.trim()
    if (text.includes('Comissão') || text.includes('Conselho') || text.includes('Comitê')) {
      committees.push({
        researcher: researcherName,
        description: text,
      })
    }
  })
  return committees
}

// Função principal para processar os arquivos
async function processLattesCurriculum() {
  const outputDir = path.join(process.cwd(), 'outputs')
  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.html'))

  const allArticles = []
  const allProjects = []
  const allExams = []
  const allCommittees = []

  for (const file of files) {
    const html = fs.readFileSync(path.join(outputDir, file), 'utf-8')
    // console.log(file)
    const root = parse(html)
    console.log(file)
    const researcherName = root.querySelector('h2.nome').innerHTML

    allArticles.push(...extractArticles(researcherName, root, file))
    allProjects.push(...extractProjects(researcherName, root, file))
    allExams.push(...extractParticipationInExamBoards(researcherName, root, file))
    allCommittees.push(...extractCommittees(researcherName, root, file))
  }

  // Criar arquivos CSV
  const csvWriters = {
    articles: createObjectCsvWriter({
      path: 'artigos.csv',
      header: [
        { id: 'year', title: 'ANO' },
        { id: 'researcher', title: 'PESQUISADOR' },
        { id: 'authors', title: 'AUTORES' },
        { id: 'title', title: 'TÍTULO' },
        { id: 'doi', title: 'DOI' },
      ],
    }),

    projects: createObjectCsvWriter({
      path: 'projetos.csv',
      alwaysQuote: false,
      header: [
        { id: 'startYear', title: 'ANO INÍCIO' },
        { id: 'endYear', title: 'ANO FIM' },
        { id: 'researcher', title: 'PESQUISADOR' },
        { id: 'title', title: 'TÍTULO' },
        { id: 'coordinator', title: 'COORDENADOR' },
        { id: 'members', title: 'INTEGRANTES' },
        { id: 'funders', title: 'FINANCIADORES' },
      ],
    }),

    exams: createObjectCsvWriter({
      path: 'bancas.csv',
      header: [
        { id: 'year', title: 'ANO' },
        { id: 'researcher', title: 'PESQUISADOR' },
        { id: 'type', title: 'TIPO' },
        { id: 'description', title: 'DESCRIÇÃO' },
      ],
    }),

    committees: createObjectCsvWriter({
      path: 'comissoes.csv',
      header: [
        { id: 'researcher', title: 'PESQUISADOR' },
        { id: 'description', title: 'DESCRIÇÃO' },
      ],
    }),
  }

  await csvWriters.articles.writeRecords(allArticles)
  await csvWriters.projects.writeRecords(allProjects)
  await csvWriters.exams.writeRecords(allExams)
  await csvWriters.committees.writeRecords(allCommittees)
}

processLattesCurriculum().catch(console.error)
