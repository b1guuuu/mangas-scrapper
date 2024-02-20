const { scrapAllLinks } = require('./src/scrapAllLinks')
const { defineScrapVolumesIntervals } = require('./src/defineScrapVolumesIntervals')

const path = require('path')
const fs = require('fs-extra')
const { spawn } = require('child_process')
const { createDbFile } = require('./src/createDbFile')

async function main() {
    const executionsDirectoryPath = path.join(__dirname, 'executions')
    await fs.ensureDir(executionsDirectoryPath)

    const dbFilePath = path.join(__dirname, 'db.json')
    const lastProcessedLinksFilePath = path.join(__dirname, 'last_processed_links.json')
    const executionWorkspace = path.join(executionsDirectoryPath, new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''))
    console.log(`CREATING WORKSPACE AT: ${executionWorkspace}`)
    await fs.ensureDir(executionWorkspace)
    
    console.log('EXTRACTING ALL LINKS')
    const linksFilePath = await scrapAllLinks(executionWorkspace)
    const divisions = 10
    console.log('')
    console.log('DEFINING LIMITS')
    const processLimits = await defineScrapVolumesIntervals(linksFilePath, divisions)

    console.log('')
    console.log('EXTRACTING VOLUMES')
    const scrapVolumesJsFilePath = path.join(__dirname, 'src', 'scrapVolumes.js')
    console.log({
        scrapVolumesJsFilePath,
        linksFilePath,
        executionWorkspace,
        dbFilePath,
        lastProcessedLinksFilePath
    })
    console.log(`CREATING ${divisions} CHILD PROCESS`)
    const childProcess = processLimits.map(({ lowerInclusiveLimit, upperNotInclusiveLimit }, index) => {
        const args = [
            scrapVolumesJsFilePath,
            '--file-path',
            linksFilePath,
            '--lower-limit',
            lowerInclusiveLimit.toString(),
            '--upper-limit',
            upperNotInclusiveLimit.toString(),
            '--process-index',
            index.toString(),
            '--execution-workspace',
            executionWorkspace,
            '--db-file-path',
            dbFilePath,
            '--last-processed-links',
            lastProcessedLinksFilePath
        ]
        return spawn('node', args)
    })

    let countExitedChildren = 0
    for await (const child of childProcess) {
        child.stdout.on('data', (data) => {
            console.log(data.toString())
        })
        child.stderr.on('data', (data)=>{
            console.error(data.toString())
        })
        child.on('exit', (code, signal) => {
            countExitedChildren++
        })
    }

    // 60000ms = 1min
    const msWaitBetweenChecks = 60000
    while(countExitedChildren < divisions){
        await sleep(msWaitBetweenChecks)
    }
    
    console.log('CREATING DB FILE')
    await createDbFile(dbFilePath, executionWorkspace)

    fs.copyFileSync(linksFilePath, lastProcessedLinksFilePath, fs.constants.COPYFILE_FICLONE)
}

const sleep = (ms) =>{
    return new Promise((resolve)=>{
        setTimeout(resolve, ms)
    })
}

main()