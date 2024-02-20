const puppeteer = require('puppeteer')
const fs = require('fs/promises')
const path = require('path')

exports.scrapAllLinks = async (executionWorkspace = '') => {
    const browser = await puppeteer.launch({ headless: 'new' })
    const [page] = await browser.pages()

    let shouldContinue = false
    let allLinks = []


    console.log('Navegando para página inicial...')

    try {
        await page.goto('http://www.guiadosquadrinhos.com/busca-avancada-resultado.aspx?tit=&num=&edi=&lic=&art=&per=&cat=&gen=4&sta=&for=&capa=0&mesi=&anoi=&mesf=&anof=')
        await page.waitForNetworkIdle({ timeout: 10000 })
    } catch (err) {
        await page.goto('http://www.guiadosquadrinhos.com/busca-avancada-resultado.aspx?tit=&num=&edi=&lic=&art=&per=&cat=&gen=4&sta=&for=&capa=0&mesi=&anoi=&mesf=&anof=')
        await page.waitForNetworkIdle({ timeout: 10000 })
    }

    console.log('Selecionando quantidade de itens por página...')
    try {
        await page.select('select#itenspagDll', '120')
        await page.waitForNetworkIdle({ timeout: 10000 })
    } catch (error) {
        await page.select('select#itenspagDll', '120')
        await page.waitForNetworkIdle({ timeout: 10000 })
    }

    let pagesCount = 1
    do {
        console.log('')
        console.log('PÁGINA ' + pagesCount)
        try {
            console.log('Buscando lista...')
            const list = await page.waitForSelector('.Lista_album_imagem_colecao')
            if (!list) {
                throw 'Não há mais lista'
            }

            console.log('Buscando links...')
            const links = await list.$$('a.suppress')
            const propertyJsHandles = await Promise.all(
                links.map(handle => handle.getProperty('href'))
            )
            const hrefs = await Promise.all(
                propertyJsHandles.map(handle => handle.jsonValue())
            )

            console.log('Concatenando links...')
            allLinks = allLinks.concat(hrefs)
            console.log('Total de links: ' + allLinks.length)

            console.log('Buscando elemento para próxima página...')
            await page.$$('.next_last')

            console.log('Clicando no elemento para próxima página')
            await page.evaluate(() => {
                __doPostBack('ctl00$MainContent$lstProfileView$dataPagerNumeric2$ctl02$ctl00', '')
            })

            shouldContinue = true
            pagesCount++
        } catch (error) {
            console.log('Não há mais elementos')
            shouldContinue = false
        }
    } while (shouldContinue)
    await browser.close()
    console.log('Escrevendo arquivo...')

    const dateSufix = new Date().toLocaleString().replaceAll('/', '').replaceAll(':', '').replaceAll(',', '').replaceAll(' ', '')
    const fileName = 'all_links_scrap_' + dateSufix + '.json'
    const filePath = path.join(executionWorkspace, fileName)
    await fs.writeFile(filePath, JSON.stringify(allLinks))
    console.log(`Arquivo salvo em: ${filePath}`)
    console.log('')
    return filePath
}