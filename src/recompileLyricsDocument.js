/**
 * Reads the document IDs written by `LyricsCompiler.addSongIdToCells`, generates a list
 * of JavaScript objects containing (minimally) document titles and IDs, then
 * sequentially writes the contents of those documents to a Google Docs document.
 *
 * @param {Object} props - Main props object
 * @param {string} props.primarySheetName - Name of the sheet to check for edit actions
 * @param {string} props.referenceSheetName - Name of the sheet to check for song IDs
 * @param {string} props.referenceSheetRange - Range in A1 format of props.referenceSheetName to check for song names and IDs
 * @param {string} props.lyricsDocumentId - ID of lyrics document
 * @param {string} props.lyricsFolder - ID of lyrics folder
 * @param {function(Array<String>): Object} [props.buildSong] - Optional function
 * @param {DocumentApp.ParagraphHeading} [props.songHeadingType = DocumentApp.ParagraphHeading.TITLE] - Optional song heading type
 */
function recompileLyricsDocument(props) {
  // Lock file
  const lock = LockService.getScriptLock()
  try {
  console.log("Acquiring lock for lyrics file")
    lock.waitLock(1000)
    console.log("Locked")
  }
  catch (e) {
    console.log(e)
    console.log("Lyrics file locked, exiting")
    return
  }

  const {
    primarySheetName,
    referenceSheetName,
    referenceSheetRange,
    lyricsDocumentId,
    lyricsFolderId,
    buildSong = (element) => {
      const [title, id] = element
      if (title.length &&  id.length) {
        return { title, id }
      }
    },
    songHeadingType = DocumentApp.ParagraphHeading.TITLE
  } = props
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()

  if (spreadsheet.getActiveSheet().getName() !== primarySheetName) {
    console.log("Not editing primary song list, exiting")
    lock.releaseLock()
    return
  }

  console.log("buildSong", buildSong)

  // Build list of song objects
  const songsList = spreadsheet
    .getSheetByName(referenceSheetName)
    .getRange(referenceSheetRange)
    .getValues()
    .reduce(
      (songs, element) => {
        const result = buildSong(element)
        if (result) songs.push(result)
        return songs
      },
      []
    )

  let update = true
  const lyricsDocumentFile = DriveApp.getFileById(lyricsDocumentId)
  // Check if we need to recompile the lyrics file
  const searchString = `modifiedDate > "${lyricsDocumentFile.getLastUpdated().toISOString()}" and "${lyricsFolderId}" in parents and trashed = false`
  const search = DriveApp.searchFiles(searchString)
  while (search.hasNext()) {
    const foundSong = search.next()
    if (songsList.find(as => as.id === foundSong.getId())) {
      console.log(`${foundSong.getName()} added or updated!`)
      update = true
    }
  }

  if (!update) {
    console.log("Lyrics files up to date with master document, exiting!")
    lock.releaseLock()
    return
  }
  let successCount = 0
  const chunkSize = 50
  let bookmarksTable = {}

  // Open lyrics document and clear the body
  let lyricsDocument = DocumentApp.openById(lyricsDocumentId)
  let lyricsDocumentBody = lyricsDocument.getBody()
  lyricsDocumentBody.clear()

  // Reset page margins
  ;["setMarginBottom", "setMarginTop", "setMarginLeft", "setMarginRight"].forEach(position => lyricsDocument[position](18))

  console.log("Updating lyrics file")

  for (let i = 0; i <= songsList.length; i += chunkSize) {
    // Flush current edits and reopen document
    // TODO: Could we speed this up by doing this only on certain iterations?
    if (i % 10 === 0) {
      lyricsDocument.saveAndClose()
      lyricsDocument = DocumentApp.openById(lyricsDocumentId)
      lyricsDocumentBody = lyricsDocument.getBody()
    }

    console.log(`Processing songs ${i} to ${Math.min(i + chunkSize - 1, songsList.length)}`)

    // For each song file
    for (const song of songsList.slice(i, i + chunkSize)) {
      try {
        // Open song file and get body copy
        const songFile = DocumentApp.openById(song.id)
        const songFileBody = songFile.getBody().copy()

        // Handle song title
        // Grab first paragraph
        const firstParagraph = songFileBody.getParagraphs()[0]

        // Remove it from the paragraphs list
        songFileBody.removeChild(firstParagraph)

        // Insert it into the new document
        const newTitle = lyricsDocumentBody.appendParagraph(firstParagraph.copy())

        // This should always be true, but let's just make sure we're clear on it
        if (firstParagraph.getHeading() === songHeadingType) {
          // Make a bookmark here
          const pos = lyricsDocument.newPosition(newTitle, 0)
          const bookmark = lyricsDocument.addBookmark(pos)
          bookmarksTable[song.title] = bookmark.getId()
        }

        // Append the rest of the document as text
        lyricsDocumentBody.appendParagraph(songFileBody.getText())

        // Add a page break
        lyricsDocumentBody.appendPageBreak()
        successCount++
      }
      catch (e) {
        console.log(`Problem with song ${song.artist} - ${song.title}: ${e}`)
      }
    }
  }

  console.log(`Successfully processed ${successCount} songs`)

  // Flush current edits and reopen document
  lyricsDocument.saveAndClose()
  lyricsDocument = DocumentApp.openById(lyricsDocumentId)

  // Remove first paragraph and insert page
  lyricsDocumentBody = lyricsDocument.getBody()
  lyricsDocumentBody.removeChild(lyricsDocumentBody.getParagraphs()[0])
  lyricsDocumentBody.insertPageBreak(0)

  // Generate table of contents
  console.log("Generating table of contents")
  try {
    // Sort bookmarks by title in reverse so we can always append to the beginning
    const reverseSortedBookmarks = Object.entries(bookmarksTable).sort(
      (name1, name2) => {
        if (name1 > name2) {
          return -1
        }
        if (name2 > name1) {
          return 1
        }

        return 0
      }
    )

    // Create bookmark styling
    const bookmarkAttrs = {
      [DocumentApp.Attribute.BOLD]: true,
      [DocumentApp.Attribute.FONT_SIZE]: 14,
      [DocumentApp.Attribute.UNDERLINE]: false,
      [DocumentApp.Attribute.FOREGROUND_COLOR]: "#000000"
    }

    // Append each bookmark to the beginning of the document
    for (const [bookmarkTitle, bookmarkId] of reverseSortedBookmarks) {
      const newBookmarkEntry = lyricsDocumentBody.insertParagraph(0, bookmarkTitle.toUpperCase())
      newBookmarkEntry.setLinkUrl(`#bookmark=${bookmarkId}`)
      newBookmarkEntry.setAttributes(bookmarkAttrs)
    }
    console.log("Successfully generated table of contents")
  }
  catch (e) {
    console.log(`Problem generating table of contents: ${e}`)
  }

  // Save and close the document
  lyricsDocument.saveAndClose()

  // Release lock
  console.log("Releasing lyrics file lock")
  lock.releaseLock()

  // Success!
  console.log("Done!")
}
