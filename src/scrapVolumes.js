const { Page, ...puppeteer } = require('puppeteer')
const fs = require('fs-extra')
const path = require('path')
const retry = require('async-retry');
const { findMangaIndexInList } = require('./findMangaIndexInList');

async function getText(selector = '', page = Page.prototype) {
    await page.waitForSelector(selector)
    return page.$eval(selector, (el) => el.textContent)
}

async function getImgSrc(selector = '', page = Page.prototype) {
    await page.waitForSelector(selector)
    return page.$eval(selector, (el) => el.src)
}

async function defineLinksToProcessArray(
    linksFilePath = '',
    lowerInclusiveLimit = 0,
    upperNotInclusiveLimit = 1,
    processIndex = 0,
    lastProcessedLinksFilePath = '') {

    const oldLinks = fs.readJsonSync(lastProcessedLinksFilePath);
    let newLinks = fs.readJsonSync(linksFilePath)
    console.log(`(${processIndex}) Processando de ${lowerInclusiveLimit} - ${upperNotInclusiveLimit - 1}`)
    newLinks = newLinks.slice(lowerInclusiveLimit, upperNotInclusiveLimit)
    const linksToProcess = []
    for(let link of newLinks){
        if(oldLinks.findIndex((l) => l===link) === -1){
            linksToProcess.push(link)
        }
    }
    return linksToProcess
}


async function scrapVolumes(
    linksFilePath = '',
    lowerInclusiveLimit = 0,
    upperNotInclusiveLimit = 1,
    processIndex = 0,
    executionWorkspace = '',
    dbFilePath = '',
    lastProcessedLinksFilePath = ''
) {
    const db = fs.readJSONSync(dbFilePath)
    const ignoredTitles = db.filter((row) => row.status.trim() !== 'Em circulação');
    const linksToProcess = await defineLinksToProcessArray(linksFilePath, lowerInclusiveLimit, upperNotInclusiveLimit, processIndex, lastProcessedLinksFilePath)
    const browser = await puppeteer.launch({ headless: 'new' })
    const [page] = await browser.pages()

    let counter = 0
    let mangas = []

    let manga = {
        title: '',
        status: '',
        publisher: '',
        volumes: [],
        totalVolumes: 0
    }

    for await (const link of linksToProcess) {
        let currentTitle = ''
        let currentPublisher = ''
        const volume = {
            volumeNumber: 0,
            release: '',
            price: 0,
            cover: ''
        }

        try {
            await retry(
                async () => {
                    console.log('')
                    console.log(`(${processIndex}) ${counter} / ${linksToProcess.length - 1}`)
                    counter++
                    console.log(`(${processIndex}) Navegando para ${link}`)
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'networkidle2' }),
                        page.goto(link)
                    ])

                    console.log(`(${processIndex}) Buscando título e número...`)
                    let title = await getText('#nome_titulo_lb', page)
                    let titleSplit = title.split('n°')
                    if (titleSplit.length > 1) {
                        currentTitle = titleSplit[0].trim()
                        volume.volumeNumber = Number(titleSplit[1].trim())
                    } else {
                        currentTitle = title.trim()
                        volume.volumeNumber = 1
                    }

                    console.log(`(${processIndex}) Buscando editora...`)
                    currentPublisher = (await getText('#editora_link', page)).trim()
                    
                    if (ignoredTitles.findIndex(t => t.title === currentTitle && t.publisher === currentPublisher) === -1) {
                        if (currentTitle !== manga.title || (currentTitle === manga.title && currentPublisher !== manga.publisher)) {
                            let mangaInListIndex = mangas.findIndex(m => m.title === currentTitle && m.publisher === currentPublisher);
                            if (mangaInListIndex > -1) {
                                manga.totalVolumes = manga.volumes.length
                                mangas.push({ ...manga })
                                manga = mangas.splice(mangaInListIndex, 1)[0];
                            } else {
                                if (manga.title !== '') {
                                    manga.totalVolumes = manga.volumes.length
                                    mangas.push({ ...manga })
                                }
                                manga = {
                                    title: currentTitle,
                                    status: '',
                                    publisher: currentPublisher.trim(),
                                    volumes: [],
                                    totalVolumes: 0
                                }
                                console.log(`(${processIndex}) Buscando status...`)
                                manga.status = (await getText('#status', page)).trim()
                            }
                        }

                        console.log(`(${processIndex}) Buscando lançamento...`)
                        volume.release = (await getText('#data_publi', page)).trim()

                        console.log(`(${processIndex}) Buscando preço...`)
                        volume.price = Number((await getText('#preco', page)).replaceAll('R$', '').replaceAll(',', '.').trim())

                        console.log(`(${processIndex}) Buscando capa...`)
                        try {
                            volume.cover = await getImgSrc('a#ampliar_capa>img', page)
                        } catch (error) {
                            try {
                                volume.cover = await getImgSrc('#sem_capa', page)
                            } catch (error) {
                                volume.cover = await getImgSrc('#cover>img', page)
                            }
                        }
                        manga.volumes.push(volume)
                    }
                }, { retries: 3, maxRetryTime: 10000 })

        } catch (error) {
            console.log(`(${processIndex}) Erro durante extração do link ${link}`)
            console.log(error)
        }
    }

    manga.totalVolumes = manga.volumes.length
    mangas.push({ ...manga })
    await browser.close()
    const fileName = `volumes-${lowerInclusiveLimit}-${upperNotInclusiveLimit - 1}.json`
    const filePath = path.join(executionWorkspace, fileName)
    fs.writeFileSync(filePath, JSON.stringify(mangas))
}

function getArgument(flag = '') {
    const flagIndex = process.argv.indexOf(flag)
    let flagValue = ''

    if (flagIndex > -1) {
        flagValue = process.argv[flagIndex + 1]
    }

    return flagValue
}

function backupDb(dbFilePath = '', executionWorkspace = '', processIndex = 0) {
    const backupDbFilePath = path.join(executionWorkspace, `${processIndex}-db.json`);
    fs.copyFileSync(dbFilePath, backupDbFilePath)
    return backupDbFilePath;
}
function backupLinks(oldLinksFilePath = '', executionWorkspace = '', processIndex = 0) {
    const backupLinksFilePath = path.join(executionWorkspace, `${processIndex}-links.json`);
    fs.copyFileSync(oldLinksFilePath, backupLinksFilePath)
    return backupLinksFilePath;
}

function main() {
    const linksFilePath = getArgument('--file-path')
    if (linksFilePath === ''){
        console.log('--file-path is invalid')
        throw '--file-path is invalid'
    }

    let dbFilePath = getArgument('--db-file-path')
    if (dbFilePath === ''){
        console.log('--db-file-path is invalid')
        throw '--db-file-path is invalid'
    }

    let lastProcessedLinksFilePath = getArgument('--last-processed-links')
    if (lastProcessedLinksFilePath === ''){
        console.log('--last-processed-links is invalid')
        throw '--last-processed-links is invalid'
    }

    const executionWorkspace = getArgument('--execution-workspace')
    if (executionWorkspace === ''){
        console.log('--execution-workspace is invalid')
        throw '--execution-workspace is invalid'
    }

    const lowerInclusiveLimit = Number(getArgument('--lower-limit'))
    if (lowerInclusiveLimit === ''){
        console.log('--lower-limit is invalid')
        throw '--lower-limit is invalid'
    }

    const upperNotInclusiveLimit = Number(getArgument('--upper-limit'))
    if (upperNotInclusiveLimit === ''){
        console.log('--upper-limit is invalid')
        throw '--upper-limit is invalid'
    }

    const processIndex = Number(getArgument('--process-index'))
    if (processIndex === ''){
        console.log('--process-index is invalid')
        throw '--process-index is invalid'
    }

    dbFilePath = backupDb(dbFilePath, executionWorkspace, processIndex)
    lastProcessedLinksFilePath = backupLinks(lastProcessedLinksFilePath, executionWorkspace, processIndex)
    scrapVolumes(linksFilePath, lowerInclusiveLimit, upperNotInclusiveLimit, processIndex, executionWorkspace, dbFilePath, lastProcessedLinksFilePath)
}

main()