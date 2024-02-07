/**
 * Opens the lyrics document, copies it to a PDF, deletes the old one if it exists,
 * then moves it to the target directory.
 *
 * @param {Object} props - Main props object
 * @param {string} props.lyricsDocumentId - ID of the lyrics document
 * @param {string} props.lyricsPdfName - Name of the new PDF document
 * @param {string} props.targetFolderId - ID of the target folder to save the PDF to
 */
function generateLyricsPDF(props) {
  // Lock file
  const lock = LockService.getScriptLock()
  try {
    console.log("Acquiring lock for PDF file")
    lock.waitLock(1000)
    console.log("Locked")
  }
  catch (e) {
    console.log(e)
    console.log("PDF file locked, exiting")
    return
  }

  const { lyricsDocumentId, lyricsPdfName, targetFolderId } = props

  // Open lyrics document
  const lyricsDocument = DocumentApp.openById(lyricsDocumentId)

  // Generate PDF blob
  const pdfBlob = lyricsDocument.getAs("application/pdf")
  console.log("Created PDF blob")

  // Store the file in Drive
  const newPdf = DriveApp.createFile(pdfBlob)
  console.log(`Wrote PDF to ${newPdf.getName()}`)

  // Find our target output folder
  const folder = DriveApp.getFolderById(targetFolderId)

  // Delete the old PDF
  const search = folder.getFilesByName(lyricsPdfName)
  while (search.hasNext()) {
    const file = search.next()
    try {
      file.setTrashed(true)
      console.log(`Successfully moved old PDF file ${file.getName()} - ${file.getId()} to trash`)
    }
    catch (e) {
      console.log(`Problem trashing old PDF file ${file.getName()} - ${file.getId()}: ${e}`)
    }
  }

  // Move new PDF into directory
  newPdf.setName(lyricsPdfName).moveTo(folder)
  console.log(`Moved ${lyricsPdfName} to song directory`)

  // Release lock
  console.log("Releasing PDF file lock")
  lock.releaseLock()

  // Success!
  console.log("Done!")
}
