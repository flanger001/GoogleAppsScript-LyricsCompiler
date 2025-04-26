const debug = false
const collator = new Intl.Collator("en", { sensitivity: "base" })
function getAllDocumentsInFolder(targetFolderId) {
  const files = DriveApp.searchFiles(`"${targetFolderId}" in parents and trashed = false`);
  const songs = [];
  while (files.hasNext()) {
    const file = files.next();
    const song = {
      name: file.getName(),
      id: file.getId()
    }
    songs.push(song);
  }
  return songs;
}

function log(...args) {
  if (!debug) {
    return
  }
  console.log(args)
}

/**
 * Reads from a Google Sheets spreadsheet, searches for a document with the name given in the cell,
 * then writes a document ID to another cell.
 *
 * @param {Object} props - Main props object
 * @param {string} props.primarySheetName - Name of the primary sheet to listen to changes on
 * @param {string} props.lyricsFolderId - ID of lyrics folder
 * @param {string} [props.primarySheetSearchColumn] - Column number to search for search string
 * @param {function(Array<string>): string} [props.buildSearchString] - Optional function to build a search string from the given cells
 * @param {string} [props.primarySheetIdColumn] - Column number to write IDs to
 */
function addSongIdToCells(event, props) {
  const {
    primarySheetName,
    lyricsFolderId,
    primarySheetSearchColumn = 1,
    buildSearchString = (element) => {
      const [title] = element;
      return title
    }
  } = props

  const sheet = SpreadsheetApp.getActiveSheet()
  const sheetName = sheet.getName()
  const primarySheetIdColumn = props.primarySheetIdColumn || sheet.getLastColumn()
  if (sheetName === primarySheetName) {
    console.log("Lyrics backing sheet found, continuing")
  }
  else {
    console.log(`Sheet ${sheetName} is not a lyrics backing sheet, exiting`)
    return
  }
  const { range } = event

  // Build list of files to search in-memory
  const files = getAllDocumentsInFolder(lyricsFolderId)
  const findFileByName = (name) => {
    log(`Searching for ${name}...`);
    return files.find((file) => collator.compare(file.name, name) === 0);
  }
  const searchRange = sheet.getRange(range.getRow(), primarySheetSearchColumn, range.getNumRows(), 2).getValues();
  const idValues = []
  for (const row of searchRange) {
    // Build our search string for our file, then check for it in our list
    const searchString = buildSearchString(row)
    const file = findFileByName(searchString)
    if (!file) {
      console.log(`File ${searchString} not found, exiting`)
      // "Write" an empty value to the cell
      idValues.push([""])
      continue
    }

    // Congratulations!
    console.log(`Found file for ${searchString} with id ${file.id}`)

    // Build ID value to write to target range
    idValues.push([file.id])
  }

  // Get our target range and write the IDs
  const targetRange = sheet.getRange(range.getRow(), primarySheetIdColumn, range.getNumRows())
  targetRange.setValues(idValues);
}
