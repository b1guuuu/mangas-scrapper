const fs = require('fs-extra')
const path = require('path')

exports.createDbFile = async (baseDbFilePath = '', executionWorkspace = '') => {
    const db = fs.readJSONSync(baseDbFilePath)
    const files = fs.readdirSync(executionWorkspace)
    let rowsToUpdateOrInsert = {
        insert: [],
        update: []
    }
    let allMangas = []
    for (let file of files) {
        if (file.startsWith('volume')) {
            let mangas = fs.readJSONSync(path.join(executionWorkspace, file))
            for (let manga of mangas) {
                if(manga.title!== ''){
                    let mangaToFixIndex = allMangas.findIndex((m) => m.title === manga.title && m.publisher === manga.publisher)
                    if (mangaToFixIndex > -1) {
                        let temp = allMangas[mangaToFixIndex]
                        let mangaToFix = {...temp}
                        allMangas.splice(mangaToFixIndex, 1);
                        mangaToFix.volumes = mangaToFix.volumes.concat(manga.volumes)
                        mangaToFix.totalVolumes += manga.totalVolumes
                        allMangas.push({...mangaToFix});
                    } else {
                        allMangas.push({...manga});
                    }
                }
            }
        }
    }

    for (let manga of allMangas) {
        const mangaInDbIndex = db.findIndex((m) => m.title === manga.title && m.publisher === manga.publisher)
        if (mangaInDbIndex === -1) {
            rowsToUpdateOrInsert.insert.push({...manga});
            db.push({...manga})
        } else {
            if (manga.totalVolumes > db[mangaInDbIndex].totalVolumes || manga.status !== db[mangaInDbIndex].status) {
                rowsToUpdateOrInsert.update.push({...manga});
                db[mangaInDbIndex] = {...manga}
            }
        }
    }

    const dbFile = path.join(executionWorkspace, 'db.json')
    const updateFile = path.join(executionWorkspace, 'update.json')
    fs.outputJSONSync(dbFile, db)
    fs.outputJSONSync(baseDbFilePath, db)
    fs.outputJSONSync(updateFile, rowsToUpdateOrInsert)
    console.log(`Database saved to: ${dbFile}`)
    console.log(`Database updated to: ${baseDbFilePath}`)
    console.log(`Update saved to: ${updateFile}`)
}