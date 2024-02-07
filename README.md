# Lyrics Compiler

This is a Google Apps Script project that provides users the ability to combine multiple Google Docs documents into a single PDF.
I call it "Lyrics Compiler" because I use it to compile song lyrics for my music projects.
It is intended to be used as a library and is available as Script ID `13sAmh5AFDGPnvd5z9iJQpCGYNVZK2cefWRTd8Xl4zm6ZvXZrqaw_XUDi`.

## Features

* Automatic table of contents - a feature which does not exist in Google Apps Script
* Fast - possible to compile 200+ documents in under 3 minutes
* Locking - quick edits will not retrigger the process
* And more

## How it works

This library exposes three functions:

### `LyricsCompiler.addSongIdToCells`

This function reads from a Google Sheets spreadsheet, searches for a document with the name given in the cell, then writes a document ID to another cell.

### `LyricsCompiler.recompileLyricsDocument`

This function reads the document IDs written by `LyricsCompiler.addSongIdToCells`, generates a list of JavaScript objects containing (minimally) document titles and IDs, then sequentially writes the contents of those documents to a Google Docs document.

### `LyricsCompiler.generateLyricsPDF`

This function opens the lyrics document, copies it to a PDF, deletes the old one if it exists, then moves it to the target directory.

## Requirements

### Permissions/scopes

* https://www.googleapis.com/auth/spreadsheets - See, edit, create, and delete all your Google Sheets spreadsheets
* https://www.googleapis.com/auth/drive - See, edit, create, and delete all of your Google Drive files
* https://www.googleapis.com/auth/documents - See, edit, create, and delete all your Google Docs documents

### Google Sheets document with bound Google Apps Script

This library requires basic knowledge of Google Apps Script.
You must first create a Google Sheets spreadsheet, then bind a Google Apps Script project to it.
This library must be added to that bound Google Apps Script project.
The spreadsheet must contain a sheet with a list of document titles.
The spreadsheet has some [additional requirements and optional QOL structure](#Spreadsheet).

### Google Docs document

This script writes to and then reads from a Google Docs document.
This document must exist (it can be blank) and the ID must be provided to the library via the spreadsheet's [required variables (documented below)](#Variables).

### Directories and filenames

This script requires the documents that will be compiled meet these conditions:

* They must be located in a single directory
* Their titles must exactly match the titles specified in the Google Sheet.
* You must have read access to the documents to be compiled

### Variables

```js
const props =  {
  // Required
  primarySheetName: "All",
  referenceSheetName: "Accepted",
  referenceSheetRange: "A2:B",
  lyricsDocumentId: "1NOJ****************************************",
  lyricsFolderId: "0B1D_***********************",
  targetFolderId: "0B1D_***********************",
  lyricsPdfName: "All Songs.pdf",
  // Optional, default to given implementation
  primarySheetIdColumn: 2, // Optional if ID column is last column in sheet
  primarySheetSearchColumn: 1,
  buildSong: (element) => {
    const [title, id] = element
    if (title.length &&  id.length) {
      return { title, id }
    }
  }
  buildSearchString:(element) => {
    const [title] = element;
    return title
  },
  songHeadingType: DocumentApp.ParagraphHeading.TITLE
}
```

## Example

### Structure

I recommend a directory structure like this:

```
.
├── ALL SONGS.gdoc
├── All Songs.pdf
├── Lyrics
│   ├── MY SONG 1.gdoc
│   └── MY SONG 2.gdoc
└── Song list.gsheet
```

Please feel free to view the [example project](https://drive.google.com/drive/folders/1U71-XSHAXmj684IBVBbXlHBpYzhdZC-c?usp=drive_link).
You are, of course, free to use whatever structure you like so long as the specified IDs are correct.

### Spreadsheet

#### Terminology and historical assumptions

This library was generalized from an exact solution, and thus some assumptions about the spreadsheet structure are built in.
The spreadsheet I built this for contained (among others) 2 sheets: "All", and "Accepted".
"All" is where I did all my editing (the "**primary sheet**"), and "Accepted" was a locked sheet where its contents were inserted from a sorted and filtered view of the "All" sheet (the "**reference sheet**").

At minimum, the spreadsheet must contain one sheet, which must be passed as `primarySheetName`.
If that sheet is the only sheet, it must also be passed as `referenceSheetName`.
Otherwise, pass the name of the **reference sheet** in `referenceSheetName`.

The `primarySheetSearchColumn` is the starting column on the **primary sheet** where  the "search string" is built.
The "search string" is built from a function `buildSearchString` that should return a song filename.

The `referenceSheetRange` is the range on the **reference sheet** where the IDs are referenced and "song objects" are built.
"Song objects" are built from a function `buildSong` that should return an object with the necessary attributes.

We do each of these in separate steps because adding document IDs needs to happen before the song files themselves can be referenced and the lyrics document rebuilt.

### Lyrics document

Lyrics documents must be formatted identically.
The title of the song must be the first element of the document.
I recommend you use the "Title" heading, but you can use any heading so long as you pass it in `songHeadingType`.
Use the `DocumentApp.ParagraphHeading` enum to pass it.
Titles are important because they are used to build the table of contents, which is represented as a list of bookmarks.

The rest of the content may be in any format and will be copied verbatim.
I do not recommend using a columnar layout.

### Project script

Since the actual script itself is not publicly viewable, I have included it below:

```js
// Code.gs

const props =  {
  primarySheetName: "All",
  referenceSheetName: "All",
  referenceSheetRange: "A2:B",
  searchColumn: 1,
  lyricsDocumentId: "1JY5n8pOB8-A6KgixlMMm3Fnw70MFCxf8EwQCXwL4VsI",
  lyricsFolderId: "1u7DFxk4MXY8TMmiWWoKtCEp1nLGkIcWt",
  targetFolderId: "1U71-XSHAXmj684IBVBbXlHBpYzhdZC-c",
  lyricsPdfName: "All Songs.pdf",
}

function main() {
  LyricsCompiler.addSongIdToCells(props)
  LyricsCompiler.recompileLyricsDocument(props)
  LyricsCompiler.generateLyricsPDF(props)
}
```

### Triggers

I recommend creating an "On Change" trigger that calls the aforementioned `main` function.
