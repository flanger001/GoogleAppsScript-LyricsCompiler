/**
 * Reads from a Google Sheets spreadsheet, searches for a document with the name given in the cell,
 * then writes a document ID to another cell.
 *
 * @param {Object} props - Main props object
 * @param {string} props.primarySheetName - Name of the primary sheet to listen to changes on
 * @param {string} props.lyricsFolderId - ID of lyrics folder
 * @param {string} [props.searchColumn] - Column number to search for search string
 * @param {function(Array<string>): string} [props.buildSearchString] - Optional function to build a search string from the given cells
 * @param {string} [props.idColumn] - Column number to write IDs to
 */
function addSongIdToCells(props) {
  const {
    primarySheetName,
    lyricsFolderId,
    searchColumn = 1,
    buildSearchString = (element) => {
      const [title] = element;
      return title
    }
  } = props

  const sheet = SpreadsheetApp.getActiveSheet()
  const sheetName = sheet.getName()
  const idColumn = props.idColumn || sheet.getLastColumn()
  if (sheetName === primarySheetName) {
    console.log("Lyrics backing sheet found, continuing")
  }
  else {
    console.log(`Sheet ${sheetName} is not a lyrics backing sheet, exiting`)
    return
  }

  // Build search string from current cell
  const cell = SpreadsheetApp.getCurrentCell()
  const searchString = sheet
    .getRange(cell.getRow(), searchColumn, 1, 2)
    .getValues()
    .reduce((str, element) => {
      return str += buildSearchString(element)
    }, "")

  // Check if lyrics file exists
  let file
  const query = `title = "${searchString}" and "${lyricsFolderId}" in parents and trashed = false`
  const search = DriveApp.searchFiles(query)
  if (search.hasNext()) {
    file = search.next()
  }
  if (!file) {
    console.log(`File ${searchString} not found, exiting`)
    return
  }

  // Congratulations!
  console.log(`Found file with id ${file.getId()}`)

  // Get target cell and write the song id
  const targetCell = sheet.getRange(cell.getRow(), idColumn, 1, 1)
  targetCell.setValue(file.getId())
  console.log(`Wrote ${file.getId()} for ${searchString} to cell ${targetCell.getA1Notation()}`)
}
