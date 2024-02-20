const fs = require('fs')

exports.defineScrapVolumesIntervals = async (linksFilePath = '', divisions = 10) => {

    const file = fs.readFileSync(linksFilePath)
    const links = await JSON.parse(file.toString())
    const baseInterval = Math.floor(links.length / divisions)

    const processLimits = []

    for (let i = 0; i < divisions; i++) {
        const lowerInclusiveLimit = i * baseInterval

        let upperNotInclusiveLimit
        if (divisions - i === 1) {
            upperNotInclusiveLimit = links.length
        } else {
            upperNotInclusiveLimit = lowerInclusiveLimit + baseInterval
        }
        processLimits.push({ lowerInclusiveLimit, upperNotInclusiveLimit })
    }

    return processLimits
}