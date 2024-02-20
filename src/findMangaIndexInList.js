exports.findMangaIndexInList = (mangas = [], manga = {
    title: '',
    status: '',
    publisher: '',
    volumes: [],
    totalVolumes: 1
}) => {
    const mangaFound = mangas.find((m)=> m.title === manga.title && m.publisher === manga.publisher)
    if(mangaFound){
        return mangas.findIndex(mangaFound)
    }else{
        return -1;
    }
}