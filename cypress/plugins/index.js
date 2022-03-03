/// <reference types="cypress" />

const { isFileExist } = require('cy-verify-downloads');
const fs = require('fs')
const path = require('path')
const pdf2table = require('pdf2table');
const folderToParse = path.join(__dirname, '..', '../cypress/downloads/PDF_reports')

/**
 * @type {Cypress.PluginConfig}
 */
module.exports = (on, config) => {
	require('cypress-mochawesome-reporter/plugin')(on);
	on('task', {
		deleteFolder(folderName) {
			console.log('deleting folder %s', folderName)

			return new Promise((resolve, reject) => {
				fs.rmdir(folderName, { maxRetries: 10, recursive: true }, (err) => {
					if (err) {
						console.error(err)

						return reject(err)
					}

					resolve(null)
				})
			})
		},
		isFileExist,
		countFiles(folderName) {
			return new Promise((resolve, reject) => {
				fs.readdir(folderName, (err, files) => {
					if (err) {
						return reject(err)
					}

					resolve(files.length)
				})
			})
		},
		pdfToTable(fileName) {
			return new Promise((resolve, reject) => {
				let pathToParse = path.join(folderToParse, fileName)
				fs.readFile(pathToParse, function (err, buffer) {
					if (err) return reject(err);

					pdf2table.parse(buffer, function (err, rows, rowsdebug) {
						if (err) return console.log(err);

						resolve(rows);
					});
				});
			})
		}
	})
}