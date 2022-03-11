/// <reference types="cypress" />
import { deleteDownloadsFolder } from '../plugins/utils'
import { Base64 } from 'js-base64';
const { softAssert, softExpect } = chai;

describe('Amazon Validation Tool', () => {

	before(deleteDownloadsFolder)

	it('should download all reports from cloud', function () {
		cy.visit(Cypress.env('googleDriveCloud'), { timeout: 10000 })
		cy.clearCookies()

		cy.get('div.iZmuQc').then(reports => {
			let reportsTotalAmount = reports.children('c-wiz').length
			let reportsFilesArr = Cypress.env('reportsFilesArr');
			pushReportsFilesNameToArr()
			function pushReportsFilesNameToArr() {
				for (let i = 0; i < reportsTotalAmount; i++) {
					let dowloadedFileName = reports.children().eq(i).prop('innerText')
					reportsFilesArr.push(dowloadedFileName)
				}
			}

			downloadAllReports()
			function downloadAllReports() {
				for (let i = 0; i < reportsFilesArr.length; i++) {
					// Downloading each report
					cy.wrap(reports).children().eq(i).realHover().find('div.akerZd').realClick()
					// Verify each report is downloaded
					cy.verifyDownload(reportsFilesArr[i], { timeout: 25000 })
				}
			}
		})
		cy.clearCookies()
	})

	it('should parse every PDF report', function () {
		for (let i = 0; i < Cypress.env('reportsFilesArr').length; i++) {
			cy.task('pdfToTable', Cypress.env('reportsFilesArr')[i]).then(content => {
				let reportRows = content
				// console.log(reportRows);
				let substrDateRange = 'Account activity from'
				let reportDateRange = reportRows[35].find(element => {
					if (element.includes(substrDateRange)) {
						return true;
					}
				})

				// Get rid of commas
				reportRows.map((elem, index) => {
					reportRows[index] = elem.map((item) => item.replace(/,/g, ''))
				})
				// console.log(reportRows);

				let reportDateYear = reportDateRange.match(/\b\d\d\d\d\b/)
				let reportDateFromMMDD = reportDateRange.match(/[A-Z]\w\w\s\d/)
				let reportDateToMMDD = reportDateRange.match(/[A-Z]\w\w\s\d\d/)

				let reportDateMounth = reportDateFromMMDD[0].match(/[A-Z]\w\w/)
				let reportDateFromDay = reportDateFromMMDD[0].match(/\d/)
				let reportDateToDay = reportDateToMMDD[0].match(/\d\d/)

				let reportDateFromTemp = reportDateYear[0] + ' ' + reportDateMounth[0] + ' ' + reportDateFromDay[0]
				let reportDateToTemp = reportDateYear[0] + ' ' + reportDateMounth[0] + ' ' + reportDateToDay[0]

				function formatDate(date) {
					let d = new Date(date),
						month = '' + (d.getMonth() + 1),
						day = '' + d.getDate(),
						year = d.getFullYear();

					if (month.length < 2)
						month = '0' + month;

					if (day.length < 2)
						day = '0' + day;

					return [year, month, day].join('-');
				}

				function refundAdministrationFees() {
					let value1 = reportRows[4][4]
					let index = reportRows[10].indexOf(value1)
					if (index === 5) {
						let refundAdministrationFees = reportRows[10][4]
						return refundAdministrationFees
					} else if (index === 4) {
						let refundAdministrationFees = reportRows[10][5]
						return refundAdministrationFees
					}
				}

				let currReportDataFromPDF = {
					[`${Cypress.env('reportsFilesArr')[i]}`]: {
						from: `${formatDate(reportDateFromTemp)}`,
						to: `${formatDate(reportDateToTemp)}`,
						Income: {
							['Product sales (non-FBA)']: parseFloat(reportRows[2][1]),
							['Product sale refunds (non-FBA)']: parseFloat(reportRows[20][1]),
							['FBA product sales']: parseFloat(reportRows[36][1]),
							['FBA product sale refunds']: parseFloat(reportRows[23][1]),
							['FBA inventory credit']: parseFloat(reportRows[24][1]),
							['FBA liquidation proceeds']: parseFloat(reportRows[6][2]),
							['FBA Liquidations proceeds adjustments']: parseFloat(reportRows[3][3]),
							['Shipping credits']: parseFloat(reportRows[3][2]),
							['Shipping credit refunds']: parseFloat(reportRows[16][2]),
							['Gift wrap credits']: parseFloat(reportRows[21][1]),
							['Gift wrap credit refunds']: parseFloat(reportRows[19][3]),
							['Promotional rebates']: parseFloat(reportRows[19][2]),
							['Promotional rebate refunds']: parseFloat(reportRows[4][1]),
							['A-to-z Guarantee claims']: parseFloat(reportRows[10][1]),
							['Chargebacks']: parseFloat(reportRows[29][1]),
							['Amazon Shipping Reimbursement']: parseFloat(reportRows[14][1]),
							['SAFE-T reimbursement']: parseFloat(reportRows[9][1]),
						},
						["Amazon Expenses"]: {
							['Seller fulfilled selling fees']: parseFloat(reportRows[2][3]),
							['FBA selling fees']: parseFloat(reportRows[20][3]),
							['Selling fee refunds']: parseFloat(reportRows[23][5]),
							['FBA transaction fees']: parseFloat(reportRows[23][4]),
							['FBA transaction fee refunds']: parseFloat(reportRows[6][6]),
							['Other transaction fees']: parseFloat(reportRows[6][5]),
							['Other transaction fee refunds']: parseFloat(reportRows[3][5]),
							['FBA inventory and inbound services fees']: parseFloat(reportRows[16][4]),
							['Shipping label purchases']: parseFloat(reportRows[21][3]),
							['Shipping label refunds']: parseFloat(reportRows[19][5]),
							['Carrier shipping label adjustments']: parseFloat(reportRows[4][5]),
							['Service fees']: parseFloat(reportRows[4][4]),
							['Refund administration fees']: parseFloat(refundAdministrationFees()),
							['Adjustments']: parseFloat(reportRows[29][4]),
							['Cost of Advertising']: parseFloat(reportRows[14][4]),
							['Refund for Advertiser']: parseFloat(reportRows[9][3]),
							['Liquidations fees']: parseFloat(reportRows[15][1]),
						}
					}
				}
				let reportsDataFromPDF = Cypress.env('reportsDataFromPDF');
				reportsDataFromPDF.push(currReportDataFromPDF)
				// console.log(reportsDataFromPDF);
			})
		}
	})

	it('should generate report from API', function () {
		for (let i = 0; i < Cypress.env('reportsDataFromPDF').length; i++) {
			let currReportDateFrom = Cypress.env('reportsDataFromPDF')[i][Cypress.env('reportsFilesArr')[i]].from
			let currReportDateTo = Cypress.env('reportsDataFromPDF')[i][Cypress.env('reportsFilesArr')[i]].to

			// Getting report ID according to the current date range
			cy.request({
				method: 'POST',
				url: `${Cypress.env('serverAddress')}/api/v2/cached-reports/`,
				headers: {
					'Authorization': `${Cypress.env('tokenJWT')}`,
					'Content-Type': 'application/json; charset=utf-8'
				},
				body: {
					"type": "profit-and-loss",
					"marketplace_id": 3,
					"name": "Profit & Loss",
					"from": `${currReportDateFrom}`,
					"to": `${currReportDateTo}`
				},
				log: true,
				encoding: "base64"
			}).then((response) => {
				let reportIDTemp = Base64.decode(response.body)
				let reportID = reportIDTemp.replace(/\"/g, "")
				let reportsID = Cypress.env('reportsID')
				reportsID.push(reportID)
			})
		}
	})

	it('should check if reports status is completed', function () {
		checkReportStatus()
		function checkReportStatus() {
			cy.request({
				method: 'GET',
				url: `${Cypress.env('serverAddress')}/api/v2/cached-reports/`,
				headers: {
					'Authorization': `${Cypress.env('tokenJWT')}`,
					'Content-Type': 'application/json; charset=utf-8'
				}
			}).then((response) => {
				let reportsStatuses = [];
				for (let i = 0; i < Cypress.env('reportsID').length; i++) {
					let currReportStatus = response.body.find(obj => obj.id === Number(Cypress.env('reportsID')[i])).status
					reportsStatuses.push(currReportStatus)
					// console.log(reportsStatuses);
				}
				if (reportsStatuses.find(status => status === 'in_progress')) {
					cy.wait(1000)
					checkReportStatus()
				} else if (reportsStatuses.every(status => status === 'completed')) {
					return //cy.log(reportsStatuses);
				}
			})
		}
	})

	it('should get every detailed report from API and compare to reports from PDF', function () {
		for (let i = 0; i < Cypress.env('reportsID').length; i++) {
			let currReportID = Cypress.env('reportsID')[i]
			// Getting detailed report from API
			cy.request({
				method: 'GET',
				url: `${Cypress.env('serverAddress')}/api/v2/cached-reports/${currReportID}`,
				headers: {
					'Authorization': `${Cypress.env('tokenJWT')}`,
					'Content-Type': 'application/json; charset=utf-8'
				}
			}).then((response) => {
				// cy.log(Cypress.env('reportsDataFromPDF'));
				// cy.log(Cypress.env('reportsFilesArr'));
				// cy.log(Cypress.env('reportsID'));
				expect(response.status).equal(200)
				expect(response.body).not.empty
				let currReportDateTo = Cypress.env('reportsDataFromPDF')[i][Cypress.env('reportsFilesArr')[i]].to
				let bodyAPI = response.body.marketplaces[0].data
				let bodyPDF = Cypress.env('reportsDataFromPDF')[i][Cypress.env('reportsFilesArr')[i]]
				let currReportFile = Cypress.env('reportsFilesArr')[i]

				let incomeProductSalesNonFbaAPI = bodyAPI['Income']['Product sales (non-FBA)'][currReportDateTo]
				let incomeProductSaleRefundsNonFbaAPI = bodyAPI['Income']['Product sale refunds (non-FBA)'][currReportDateTo]
				let incomeFbaProductSalesAPI = bodyAPI['Income']['FBA product sales'][currReportDateTo]
				let incomeFbaProductSaleRefundsAPI = bodyAPI['Income']['FBA product sale refunds'][currReportDateTo]
				let incomeFbaInventoryCreditAPI = bodyAPI['Income']['FBA inventory credit'][currReportDateTo]
				let incomeFbaLiquidationProceedsAPI = bodyAPI['Income']['FBA liquidation proceeds'][currReportDateTo]
				let incomeFbaLiquidationsProceedsAdjustmentsAPI = bodyAPI['Income']['FBA Liquidations proceeds adjustments'][currReportDateTo]
				let incomeShippingCreditsAPI = bodyAPI['Income']['Shipping credits'][currReportDateTo]
				let incomeShippingCreditRefundsAPI = bodyAPI['Income']['Shipping credit refunds'][currReportDateTo]
				let incomeGiftWrapCreditsAPI = bodyAPI['Income']['Gift wrap credits'][currReportDateTo]
				let incomeGiftWrapCreditRefundsAPI = bodyAPI['Income']['Gift wrap credit refunds'][currReportDateTo]
				let incomePromotionalRebatesAPI = bodyAPI['Income']['Promotional rebates'][currReportDateTo]
				let incomePromotionalRebateRefundsAPI = bodyAPI['Income']['Promotional rebate refunds'][currReportDateTo]
				let incomeAToZGuaranteeClaimsAPI = bodyAPI['Income']['A-to-z Guarantee claims'][currReportDateTo]
				let incomeChargebacksAPI = bodyAPI['Income']['Chargebacks'][currReportDateTo]
				let incomeAmazonShippingReimbursementAPI = bodyAPI['Income']['Amazon Shipping Reimbursement'][currReportDateTo]
				let incomeSafeTReimbursementAPI = bodyAPI['Income']['SAFE-T reimbursement'][currReportDateTo]
				let expensesSellerFulfilledSellingFeesAPI = bodyAPI['Amazon Expenses']['Seller fulfilled selling fees'][currReportDateTo]
				let expensesFbaSellingFeesAPI = bodyAPI['Amazon Expenses']['FBA selling fees'][currReportDateTo]
				let expensesSellingFeeRefundsAPI = bodyAPI['Amazon Expenses']['Selling fee refunds'][currReportDateTo]
				let expensesFbaTransactionFeesAPI = bodyAPI['Amazon Expenses']['FBA transaction fees'][currReportDateTo]
				let expensesFbaTransactionFeeRefundsAPI = bodyAPI['Amazon Expenses']['FBA transaction fee refunds'][currReportDateTo]
				let expensesOtherTransactionFeesAPI = bodyAPI['Amazon Expenses']['Other transaction fees'][currReportDateTo]
				let expensesOtherTransactionFeeRefundsAPI = bodyAPI['Amazon Expenses']['Other transaction fee refunds'][currReportDateTo]
				let expensesFbaInventoryAndInboundServicesFeesAPI = bodyAPI['Amazon Expenses']['FBA inventory and inbound services fees'][currReportDateTo]
				let expensesShippingLabelPurchasesAPI = bodyAPI['Amazon Expenses']['Shipping label purchases'][currReportDateTo]
				let expensesShippingLabelRefundsAPI = bodyAPI['Amazon Expenses']['Shipping label refunds'][currReportDateTo]
				let expensesCarrierShippingLabelAdjustmentsAPI = bodyAPI['Amazon Expenses']['Carrier shipping label adjustments'][currReportDateTo]
				let expensesServiceFeesAPI = bodyAPI['Amazon Expenses']['Service fees'][currReportDateTo]
				let expensesRefundAdministrationFeesAPI = bodyAPI['Amazon Expenses']['Refund administration fees'][currReportDateTo]
				let expensesAdjustmentsAPI = bodyAPI['Amazon Expenses']['Adjustments'][currReportDateTo]
				let expensesCostOfAdvertisingAPI = bodyAPI['Amazon Expenses']['Cost of Advertising'][currReportDateTo]
				let expensesRefundForAdvertiserAPI = bodyAPI['Amazon Expenses']['Refund for Advertiser'][currReportDateTo]
				let expensesLiquidationsFeesAPI = bodyAPI['Amazon Expenses']['Liquidations fees'][currReportDateTo]

				let incomeProductSalesNonFbaPDF = bodyPDF['Income']['Product sales (non-FBA)']
				let incomeProductSaleRefundsNonFbaPDF = bodyPDF['Income']['Product sale refunds (non-FBA)']
				let incomeFbaProductSalesPDF = bodyPDF['Income']['FBA product sales']
				let incomeFbaProductSaleRefundsPDF = bodyPDF['Income']['FBA product sale refunds']
				let incomeFbaInventoryCreditPDF = bodyPDF['Income']['FBA inventory credit']
				let incomeFbaLiquidationProceedsPDF = bodyPDF['Income']['FBA liquidation proceeds']
				let incomeFbaLiquidationsProceedsAdjustmentsPDF = bodyPDF['Income']['FBA Liquidations proceeds adjustments']
				let incomeShippingCreditsPDF = bodyPDF['Income']['Shipping credits']
				let incomeShippingCreditRefundsPDF = bodyPDF['Income']['Shipping credit refunds']
				let incomeGiftWrapCreditsPDF = bodyPDF['Income']['Gift wrap credits']
				let incomeGiftWrapCreditRefundsPDF = bodyPDF['Income']['Gift wrap credit refunds']
				let incomePromotionalRebatesPDF = bodyPDF['Income']['Promotional rebates']
				let incomePromotionalRebateRefundsPDF = bodyPDF['Income']['Promotional rebate refunds']
				let incomeAToZGuaranteeClaimsPDF = bodyPDF['Income']['A-to-z Guarantee claims']
				let incomeChargebacksPDF = bodyPDF['Income']['Chargebacks']
				let incomeAmazonShippingReimbursementPDF = bodyPDF['Income']['Amazon Shipping Reimbursement']
				let incomeSafeTReimbursementPDF = bodyPDF['Income']['SAFE-T reimbursement']
				let expensesSellerFulfilledSellingFeesPDF = bodyPDF['Amazon Expenses']['Seller fulfilled selling fees']
				let expensesFbaSellingFeesPDF = bodyPDF['Amazon Expenses']['FBA selling fees']
				let expensesSellingFeeRefundsPDF = bodyPDF['Amazon Expenses']['Selling fee refunds']
				let expensesFbaTransactionFeesPDF = bodyPDF['Amazon Expenses']['FBA transaction fees']
				let expensesFbaTransactionFeeRefundsPDF = bodyPDF['Amazon Expenses']['FBA transaction fee refunds']
				let expensesOtherTransactionFeesPDF = bodyPDF['Amazon Expenses']['Other transaction fees']
				let expensesOtherTransactionFeeRefundsPDF = bodyPDF['Amazon Expenses']['Other transaction fee refunds']
				let expensesFbaInventoryAndInboundServicesFeesPDF = bodyPDF['Amazon Expenses']['FBA inventory and inbound services fees']
				let expensesShippingLabelPurchasesPDF = bodyPDF['Amazon Expenses']['Shipping label purchases']
				let expensesShippingLabelRefundsPDF = bodyPDF['Amazon Expenses']['Shipping label refunds']
				let expensesCarrierShippingLabelAdjustmentsPDF = bodyPDF['Amazon Expenses']['Carrier shipping label adjustments']
				let expensesServiceFeesPDF = bodyPDF['Amazon Expenses']['Service fees']
				let expensesRefundAdministrationFeesPDF = bodyPDF['Amazon Expenses']['Refund administration fees']
				let expensesAdjustmentsPDF = bodyPDF['Amazon Expenses']['Adjustments']
				let expensesCostOfAdvertisingPDF = bodyPDF['Amazon Expenses']['Cost of Advertising']
				let expensesRefundForAdvertiserPDF = bodyPDF['Amazon Expenses']['Refund for Advertiser']
				let expensesLiquidationsFeesPDF = bodyPDF['Amazon Expenses']['Liquidations fees']

				let discrepancyAll = Cypress.env('discrepancyAll');

				if (incomeProductSalesNonFbaAPI != incomeProductSalesNonFbaPDF) {
					discrepancyAll.push(Number(Math.abs(incomeProductSalesNonFbaAPI - incomeProductSalesNonFbaPDF).toFixed(2)))
				}

				if (incomeProductSaleRefundsNonFbaAPI != incomeProductSaleRefundsNonFbaPDF) {
					discrepancyAll.push(Number(Math.abs(incomeProductSaleRefundsNonFbaAPI - incomeProductSaleRefundsNonFbaPDF).toFixed(2)))
				}

				if (incomeFbaProductSalesAPI != incomeFbaProductSalesPDF) {
					discrepancyAll.push(Number(Math.abs(incomeFbaProductSalesAPI - incomeFbaProductSalesPDF).toFixed(2)))
				}

				if (incomeFbaProductSaleRefundsAPI != incomeFbaProductSaleRefundsPDF) {
					discrepancyAll.push(Number(Math.abs(incomeFbaProductSaleRefundsAPI - incomeFbaProductSaleRefundsPDF).toFixed(2)))
				}

				if (incomeFbaInventoryCreditAPI != incomeFbaInventoryCreditPDF) {
					discrepancyAll.push(Number(Math.abs(incomeFbaInventoryCreditAPI - incomeFbaInventoryCreditPDF).toFixed(2)))
				}

				if (incomeFbaLiquidationProceedsAPI != incomeFbaLiquidationProceedsPDF) {
					discrepancyAll.push(Number(Math.abs(incomeFbaLiquidationProceedsAPI - incomeFbaLiquidationProceedsPDF).toFixed(2)))
				}

				if (incomeFbaLiquidationsProceedsAdjustmentsAPI != incomeFbaLiquidationsProceedsAdjustmentsPDF) {
					discrepancyAll.push(Number(Math.abs(incomeFbaLiquidationsProceedsAdjustmentsAPI - incomeFbaLiquidationsProceedsAdjustmentsPDF).toFixed(2)))
				}

				if (incomeShippingCreditsAPI != incomeShippingCreditsPDF) {
					discrepancyAll.push(Number(Math.abs(incomeShippingCreditsAPI - incomeShippingCreditsPDF).toFixed(2)))
				}

				if (incomeShippingCreditRefundsAPI != incomeShippingCreditRefundsPDF) {
					discrepancyAll.push(Number(Math.abs(incomeShippingCreditRefundsAPI - incomeShippingCreditRefundsPDF).toFixed(2)))
				}

				if (incomeGiftWrapCreditsAPI != incomeGiftWrapCreditsPDF) {
					discrepancyAll.push(Number(Math.abs(incomeGiftWrapCreditsAPI - incomeGiftWrapCreditsPDF).toFixed(2)))
				}

				if (incomeGiftWrapCreditRefundsAPI != incomeGiftWrapCreditRefundsPDF) {
					discrepancyAll.push(Number(Math.abs(incomeGiftWrapCreditRefundsAPI - incomeGiftWrapCreditRefundsPDF).toFixed(2)))
				}

				if (incomePromotionalRebatesAPI != incomePromotionalRebatesPDF) {
					discrepancyAll.push(Number(Math.abs(incomePromotionalRebatesAPI - incomePromotionalRebatesPDF).toFixed(2)))
				}

				if (incomePromotionalRebateRefundsAPI != incomePromotionalRebateRefundsPDF) {
					discrepancyAll.push(Number(Math.abs(incomePromotionalRebateRefundsAPI - incomePromotionalRebateRefundsPDF).toFixed(2)))
				}

				if (incomeAToZGuaranteeClaimsAPI != incomeAToZGuaranteeClaimsPDF) {
					discrepancyAll.push(Number(Math.abs(incomeAToZGuaranteeClaimsAPI - incomeAToZGuaranteeClaimsPDF).toFixed(2)))
				}

				if (incomeChargebacksAPI != incomeChargebacksPDF) {
					discrepancyAll.push(Number(Math.abs(incomeChargebacksAPI - incomeChargebacksPDF).toFixed(2)))
				}

				if (incomeAmazonShippingReimbursementAPI != incomeAmazonShippingReimbursementPDF) {
					discrepancyAll.push(Number(Math.abs(incomeAmazonShippingReimbursementAPI - incomeAmazonShippingReimbursementPDF).toFixed(2)))
				}

				if (incomeSafeTReimbursementAPI != incomeSafeTReimbursementPDF) {
					discrepancyAll.push(Number(Math.abs(incomeSafeTReimbursementAPI - incomeSafeTReimbursementPDF).toFixed(2)))
				}

				if (expensesSellerFulfilledSellingFeesAPI != expensesSellerFulfilledSellingFeesPDF) {
					discrepancyAll.push(Number(Math.abs(expensesSellerFulfilledSellingFeesAPI - expensesSellerFulfilledSellingFeesPDF).toFixed(2)))
				}

				if (expensesFbaSellingFeesAPI != expensesFbaSellingFeesPDF) {
					discrepancyAll.push(Number(Math.abs(expensesFbaSellingFeesAPI - expensesFbaSellingFeesPDF).toFixed(2)))
				}

				if (expensesSellingFeeRefundsAPI != expensesSellingFeeRefundsPDF) {
					discrepancyAll.push(Number(Math.abs(expensesSellingFeeRefundsAPI - expensesSellingFeeRefundsPDF).toFixed(2)))
				}

				if (expensesFbaTransactionFeesAPI != expensesFbaTransactionFeesPDF) {
					discrepancyAll.push(Number(Math.abs(expensesFbaTransactionFeesAPI - expensesFbaTransactionFeesPDF).toFixed(2)))
				}

				if (expensesFbaTransactionFeeRefundsAPI != expensesFbaTransactionFeeRefundsPDF) {
					discrepancyAll.push(Number(Math.abs(expensesFbaTransactionFeeRefundsAPI - expensesFbaTransactionFeeRefundsPDF).toFixed(2)))
				}

				if (expensesOtherTransactionFeesAPI != expensesOtherTransactionFeesPDF) {
					discrepancyAll.push(Number(Math.abs(expensesOtherTransactionFeesAPI - expensesOtherTransactionFeesPDF).toFixed(2)))
				}

				if (expensesOtherTransactionFeeRefundsAPI != expensesOtherTransactionFeeRefundsPDF) {
					discrepancyAll.push(Number(Math.abs(expensesOtherTransactionFeeRefundsAPI - expensesOtherTransactionFeeRefundsPDF).toFixed(2)))
				}

				if (expensesFbaInventoryAndInboundServicesFeesAPI != expensesFbaInventoryAndInboundServicesFeesPDF) {
					discrepancyAll.push(Number(Math.abs(expensesFbaInventoryAndInboundServicesFeesAPI - expensesFbaInventoryAndInboundServicesFeesPDF).toFixed(2)))
				}

				if (expensesShippingLabelPurchasesAPI != expensesShippingLabelPurchasesPDF) {
					discrepancyAll.push(Number(Math.abs(expensesShippingLabelPurchasesAPI - expensesShippingLabelPurchasesPDF).toFixed(2)))
				}

				if (expensesShippingLabelRefundsAPI != expensesShippingLabelRefundsPDF) {
					discrepancyAll.push(Number(Math.abs(expensesShippingLabelRefundsAPI - expensesShippingLabelRefundsPDF).toFixed(2)))
				}

				if (expensesCarrierShippingLabelAdjustmentsAPI != expensesCarrierShippingLabelAdjustmentsPDF) {
					discrepancyAll.push(Number(Math.abs(expensesCarrierShippingLabelAdjustmentsAPI - expensesCarrierShippingLabelAdjustmentsPDF).toFixed(2)))
				}

				if (expensesServiceFeesAPI != expensesServiceFeesPDF) {
					discrepancyAll.push(Number(Math.abs(expensesServiceFeesAPI - expensesServiceFeesPDF).toFixed(2)))
				}

				if (expensesRefundAdministrationFeesAPI != expensesRefundAdministrationFeesPDF) {
					discrepancyAll.push(Number(Math.abs(expensesRefundAdministrationFeesAPI - expensesRefundAdministrationFeesPDF).toFixed(2)))
				}

				if (expensesAdjustmentsAPI != expensesAdjustmentsPDF) {
					discrepancyAll.push(Number(Math.abs(expensesAdjustmentsAPI - expensesAdjustmentsPDF).toFixed(2)))
				}

				if (expensesCostOfAdvertisingAPI != expensesCostOfAdvertisingPDF) {
					discrepancyAll.push(Number(Math.abs(expensesCostOfAdvertisingAPI - expensesCostOfAdvertisingPDF).toFixed(2)))
				}

				if (expensesRefundForAdvertiserAPI != expensesRefundForAdvertiserPDF) {
					discrepancyAll.push(Number(Math.abs(expensesRefundForAdvertiserAPI - expensesRefundForAdvertiserPDF).toFixed(2)))
				}

				if (expensesLiquidationsFeesAPI != expensesLiquidationsFeesPDF) {
					discrepancyAll.push(Number(Math.abs(expensesLiquidationsFeesAPI - expensesLiquidationsFeesPDF).toFixed(2)))
				}

				discrepancyAll.sort((a, b) => b - a)
				let discrepancyMax = discrepancyAll[0];
				let discrepancySum = discrepancyAll.reduce(function (acc, elem) {
					return Number((acc + elem).toFixed(2))
				})

				let discrepancyTotalSum = Cypress.env('discrepancyTotalSum')
				let discrepancyAllMaxArr = Cypress.env('discrepancyAllMaxArr')
				discrepancyTotalSum.push(discrepancySum)
				discrepancyTotalSum.sort((a, b) => b - a)

				discrepancyAllMaxArr.push(discrepancyMax)
				discrepancyAllMaxArr.sort((a, b) => b - a)


				let currDiscrepancyAllObj = {
					[`${Cypress.env('reportsFilesArr')[i]}`]: {
						['Product sales (non-FBA)']: Number(Math.abs(incomeProductSalesNonFbaAPI - incomeProductSalesNonFbaPDF).toFixed(2)),
						['Product sale refunds (non-FBA)']: Number(Math.abs(incomeProductSaleRefundsNonFbaAPI - incomeProductSaleRefundsNonFbaPDF).toFixed(2)),
						['FBA product sales']: Number(Math.abs(incomeFbaProductSalesAPI - incomeFbaProductSalesPDF).toFixed(2)),
						['FBA product sale refunds']: Number(Math.abs(incomeFbaProductSaleRefundsAPI - incomeFbaProductSaleRefundsPDF).toFixed(2)),
						['FBA inventory credit']: Number(Math.abs(incomeFbaInventoryCreditAPI - incomeFbaInventoryCreditPDF).toFixed(2)),
						['FBA liquidation proceeds']: Number(Math.abs(incomeFbaLiquidationProceedsAPI - incomeFbaLiquidationProceedsPDF).toFixed(2)),
						['FBA Liquidations proceeds adjustments']: Number(Math.abs(incomeFbaLiquidationsProceedsAdjustmentsAPI - incomeFbaLiquidationsProceedsAdjustmentsPDF).toFixed(2)),
						['Shipping credits']: Number(Math.abs(incomeShippingCreditsAPI - incomeShippingCreditsPDF).toFixed(2)),
						['Shipping credit refunds']: Number(Math.abs(incomeShippingCreditRefundsAPI - incomeShippingCreditRefundsPDF).toFixed(2)),
						['Gift wrap credits']: Number(Math.abs(incomeGiftWrapCreditsAPI - incomeGiftWrapCreditsPDF).toFixed(2)),
						['Gift wrap credit refunds']: Number(Math.abs(incomeGiftWrapCreditRefundsAPI - incomeGiftWrapCreditRefundsPDF).toFixed(2)),
						['Promotional rebates']: Number(Math.abs(incomePromotionalRebatesAPI - incomePromotionalRebatesPDF).toFixed(2)),
						['Promotional rebate refunds']: Number(Math.abs(incomePromotionalRebateRefundsAPI - incomePromotionalRebateRefundsPDF).toFixed(2)),
						['A-to-z Guarantee claims']: Number(Math.abs(incomeAToZGuaranteeClaimsAPI - incomeAToZGuaranteeClaimsPDF).toFixed(2)),
						['Chargebacks']: Number(Math.abs(incomeChargebacksAPI - incomeChargebacksPDF).toFixed(2)),
						['Amazon Shipping Reimbursement']: Number(Math.abs(incomeAmazonShippingReimbursementAPI - incomeAmazonShippingReimbursementPDF).toFixed(2)),
						['SAFE-T reimbursement']: Number(Math.abs(incomeSafeTReimbursementAPI - incomeSafeTReimbursementPDF).toFixed(2)),
						['Seller fulfilled selling fees']: Number(Math.abs(expensesSellerFulfilledSellingFeesAPI - expensesSellerFulfilledSellingFeesPDF).toFixed(2)),
						['FBA selling fees']: Number(Math.abs(expensesFbaSellingFeesAPI - expensesFbaSellingFeesPDF).toFixed(2)),
						['Selling fee refunds']: Number(Math.abs(expensesSellingFeeRefundsAPI - expensesSellingFeeRefundsPDF).toFixed(2)),
						['FBA transaction fees']: Number(Math.abs(expensesFbaTransactionFeesAPI - expensesFbaTransactionFeesPDF).toFixed(2)),
						['FBA transaction fee refunds']: Number(Math.abs(expensesFbaTransactionFeeRefundsAPI - expensesFbaTransactionFeeRefundsPDF).toFixed(2)),
						['Other transaction fees']: Number(Math.abs(expensesOtherTransactionFeesAPI - expensesOtherTransactionFeesPDF).toFixed(2)),
						['Other transaction fee refunds']: Number(Math.abs(expensesOtherTransactionFeeRefundsAPI - expensesOtherTransactionFeeRefundsPDF).toFixed(2)),
						['FBA inventory and inbound services fees']: Number(Math.abs(expensesFbaInventoryAndInboundServicesFeesAPI - expensesFbaInventoryAndInboundServicesFeesPDF).toFixed(2)),
						['Shipping label purchases']: Number(Math.abs(expensesShippingLabelPurchasesAPI - expensesShippingLabelPurchasesPDF).toFixed(2)),
						['Shipping label refunds']: Number(Math.abs(expensesShippingLabelRefundsAPI - expensesShippingLabelRefundsPDF).toFixed(2)),
						['Carrier shipping label adjustments']: Number(Math.abs(expensesCarrierShippingLabelAdjustmentsAPI - expensesCarrierShippingLabelAdjustmentsPDF).toFixed(2)),
						['Service fees']: Number(Math.abs(expensesServiceFeesAPI - expensesServiceFeesPDF).toFixed(2)),
						['Refund administration fees']: Number(Math.abs(expensesRefundAdministrationFeesAPI - expensesRefundAdministrationFeesPDF).toFixed(2)),
						['Adjustments']: Number(Math.abs(expensesAdjustmentsAPI - expensesAdjustmentsPDF).toFixed(2)),
						['Cost of Advertising']: Number(Math.abs(expensesCostOfAdvertisingAPI - expensesCostOfAdvertisingPDF).toFixed(2)),
						['Refund for Advertiser']: Number(Math.abs(expensesRefundForAdvertiserAPI - expensesRefundForAdvertiserPDF).toFixed(2)),
						['Liquidations fees']: Number(Math.abs(expensesLiquidationsFeesAPI - expensesLiquidationsFeesPDF).toFixed(2)),

					}
				}
				Cypress.env('discrepancyAllArr').push(currDiscrepancyAllObj)

				for (const [key, value] of Object.entries(Cypress.env('discrepancyAllArr')[i][Cypress.env('reportsFilesArr')[i]])) {
					if (value === discrepancyMax) {
						let nameOfMaxMetrix = 'Max discrepancy: ' + value + ' - ' + key
						let discrepancyMaxWithName = Cypress.env('discrepancyMaxWithName')
						discrepancyMaxWithName.push(nameOfMaxMetrix)
					}
				}


				softAssert(incomeProductSalesNonFbaAPI === incomeProductSalesNonFbaPDF, `${currReportFile} -> Income - Product sales (non-FBA): API ${incomeProductSalesNonFbaAPI} should equal PDF ${incomeProductSalesNonFbaPDF}`);
				softAssert(incomeProductSaleRefundsNonFbaAPI === incomeProductSaleRefundsNonFbaPDF, `${currReportFile} -> Income - Product sales (non-FBA): API ${incomeProductSaleRefundsNonFbaAPI} should equal PDF ${incomeProductSaleRefundsNonFbaPDF}`);
				softAssert(incomeFbaProductSalesAPI === incomeFbaProductSalesPDF, `${currReportFile} -> Income - FBA product sales: API ${incomeFbaProductSalesAPI} should equal PDF ${incomeFbaProductSalesPDF}`);
				softAssert(incomeFbaProductSaleRefundsAPI === incomeFbaProductSaleRefundsPDF, `${currReportFile} -> Income - FBA product sale refunds: API ${incomeFbaProductSaleRefundsAPI} should equal PDF ${incomeFbaProductSaleRefundsPDF}`);
				softAssert(incomeFbaInventoryCreditAPI === incomeFbaInventoryCreditPDF, `${currReportFile} -> Income - FBA inventory credit: API ${incomeFbaInventoryCreditAPI} should equal PDF ${incomeFbaInventoryCreditPDF}`);
				softAssert(incomeFbaLiquidationProceedsAPI === incomeFbaLiquidationProceedsPDF, `${currReportFile} -> Income - FBA liquidation proceeds: API ${incomeFbaLiquidationProceedsAPI} should equal PDF ${incomeFbaLiquidationProceedsPDF}`);
				softAssert(incomeFbaLiquidationsProceedsAdjustmentsAPI === incomeFbaLiquidationsProceedsAdjustmentsPDF, `${currReportFile} -> Income - FBA Liquidations proceeds adjustments: API ${incomeFbaLiquidationsProceedsAdjustmentsAPI} should equal PDF ${incomeFbaLiquidationsProceedsAdjustmentsPDF}`);
				softAssert(incomeShippingCreditsAPI === incomeShippingCreditsPDF, `${currReportFile} -> Income - Shipping credits: API ${incomeShippingCreditsAPI} should equal PDF ${incomeShippingCreditsPDF}`);
				softAssert(incomeShippingCreditRefundsAPI === incomeShippingCreditRefundsPDF, `${currReportFile} -> Income - Shipping credit refunds: API ${incomeShippingCreditRefundsAPI} should equal PDF ${incomeShippingCreditRefundsPDF}`);
				softAssert(incomeGiftWrapCreditsAPI === incomeGiftWrapCreditsPDF, `${currReportFile} -> Income - Gift wrap credits: API ${incomeGiftWrapCreditsAPI} should equal PDF ${incomeGiftWrapCreditsPDF}`);
				softAssert(incomeGiftWrapCreditRefundsAPI === incomeGiftWrapCreditRefundsPDF, `${currReportFile} -> Income - Gift wrap credit refunds: API ${incomeGiftWrapCreditRefundsAPI} should equal PDF ${incomeGiftWrapCreditRefundsPDF}`);
				softAssert(incomePromotionalRebatesAPI === incomePromotionalRebatesPDF, `${currReportFile} -> Income - Promotional rebates: API ${incomePromotionalRebatesAPI} should equal PDF ${incomePromotionalRebatesPDF}`);
				softAssert(incomePromotionalRebateRefundsAPI === incomePromotionalRebateRefundsPDF, `${currReportFile} -> Income - Promotional rebate refunds: API ${incomePromotionalRebateRefundsAPI} should equal PDF ${incomePromotionalRebateRefundsPDF}`);
				softAssert(incomeAToZGuaranteeClaimsAPI === incomeAToZGuaranteeClaimsPDF, `${currReportFile} -> Income - A-to-z Guarantee claims: API ${incomeAToZGuaranteeClaimsAPI} should equal PDF ${incomeAToZGuaranteeClaimsPDF}`);
				softAssert(incomeChargebacksAPI === incomeChargebacksPDF, `${currReportFile} -> Income - Chargebacks: API ${incomeChargebacksAPI} should equal PDF ${incomeChargebacksPDF}`);
				softAssert(incomeAmazonShippingReimbursementAPI === incomeAmazonShippingReimbursementPDF, `${currReportFile} -> Income - Amazon Shipping Reimbursement: API ${incomeAmazonShippingReimbursementAPI} should equal PDF ${incomeAmazonShippingReimbursementPDF}`);
				softAssert(incomeSafeTReimbursementAPI === incomeSafeTReimbursementPDF, `${currReportFile} -> Income - SAFE-T reimbursement: API ${incomeSafeTReimbursementAPI} should equal PDF ${incomeSafeTReimbursementPDF}`);
				softAssert(expensesSellerFulfilledSellingFeesAPI === expensesSellerFulfilledSellingFeesPDF, `${currReportFile} -> Amazon Expenses - Seller fulfilled selling fees: API ${expensesSellerFulfilledSellingFeesAPI} should equal PDF ${expensesSellerFulfilledSellingFeesPDF}`);
				softAssert(expensesFbaSellingFeesAPI === expensesFbaSellingFeesPDF, `${currReportFile} -> Amazon Expenses - FBA selling fees: API ${expensesFbaSellingFeesAPI} should equal PDF ${expensesFbaSellingFeesPDF}`);
				softAssert(expensesSellingFeeRefundsAPI === expensesSellingFeeRefundsPDF, `${currReportFile} -> Amazon Expenses - Selling fee refunds: API ${expensesSellingFeeRefundsAPI} should equal PDF ${expensesSellingFeeRefundsPDF}`);
				softAssert(expensesFbaTransactionFeesAPI === expensesFbaTransactionFeesPDF, `${currReportFile} -> Amazon Expenses - FBA transaction fees: API ${expensesFbaTransactionFeesAPI} should equal PDF ${expensesFbaTransactionFeesPDF}`);
				softAssert(expensesFbaTransactionFeeRefundsAPI === expensesFbaTransactionFeeRefundsPDF, `${currReportFile} -> Amazon Expenses - FBA transaction fee refunds: API ${expensesFbaTransactionFeeRefundsAPI} should equal PDF ${expensesFbaTransactionFeeRefundsPDF}`);
				softAssert(expensesOtherTransactionFeesAPI === expensesOtherTransactionFeesPDF, `${currReportFile} -> Amazon Expenses - Other transaction fees: API ${expensesOtherTransactionFeesAPI} should equal PDF ${expensesOtherTransactionFeesPDF}`);
				softAssert(expensesOtherTransactionFeeRefundsAPI === expensesOtherTransactionFeeRefundsPDF, `${currReportFile} -> Amazon Expenses - Other transaction fee refunds: API ${expensesOtherTransactionFeeRefundsAPI} should equal PDF ${expensesOtherTransactionFeeRefundsPDF}`);
				softAssert(expensesFbaInventoryAndInboundServicesFeesAPI === expensesFbaInventoryAndInboundServicesFeesPDF, `${currReportFile} -> Amazon Expenses - FBA inventory and inbound services fees: API ${expensesFbaInventoryAndInboundServicesFeesAPI} should equal PDF ${expensesFbaInventoryAndInboundServicesFeesPDF}`);
				softAssert(expensesShippingLabelPurchasesAPI === expensesShippingLabelPurchasesPDF, `${currReportFile} -> Amazon Expenses - Shipping label purchases: API ${expensesShippingLabelPurchasesAPI} should equal PDF ${expensesShippingLabelPurchasesPDF}`);
				softAssert(expensesShippingLabelRefundsAPI === expensesShippingLabelRefundsPDF, `${currReportFile} -> Amazon Expenses - Shipping label refunds: API ${expensesShippingLabelRefundsAPI} should equal PDF ${expensesShippingLabelRefundsPDF}`);
				softAssert(expensesCarrierShippingLabelAdjustmentsAPI === expensesCarrierShippingLabelAdjustmentsPDF, `${currReportFile} -> Amazon Expenses - Carrier shipping label adjustments: API ${expensesCarrierShippingLabelAdjustmentsAPI} should equal PDF ${expensesCarrierShippingLabelAdjustmentsPDF}`);
				softAssert(expensesServiceFeesAPI === expensesServiceFeesPDF, `${currReportFile} -> Amazon Expenses - Service fees: API ${expensesServiceFeesAPI} should equal PDF ${expensesServiceFeesPDF}`);
				softAssert(expensesRefundAdministrationFeesAPI === expensesRefundAdministrationFeesPDF, `${currReportFile} -> Amazon Expenses - Refund administration fees: API ${expensesRefundAdministrationFeesAPI} should equal PDF ${expensesRefundAdministrationFeesPDF}`);
				softAssert(expensesAdjustmentsAPI === expensesAdjustmentsPDF, `${currReportFile} -> Amazon Expenses - Adjustments: API ${expensesAdjustmentsAPI} should equal PDF ${expensesAdjustmentsPDF}`);
				softAssert(expensesCostOfAdvertisingAPI === expensesCostOfAdvertisingPDF, `${currReportFile} -> Amazon Expenses - Cost of Advertising: API ${expensesCostOfAdvertisingAPI} should equal PDF ${expensesCostOfAdvertisingPDF}`);
				softAssert(expensesRefundForAdvertiserAPI === expensesRefundForAdvertiserPDF, `${currReportFile} -> Amazon Expenses - Refund for Advertiser: API ${expensesRefundForAdvertiserAPI} should equal PDF ${expensesRefundForAdvertiserPDF}`);
				softAssert(expensesLiquidationsFeesAPI === expensesLiquidationsFeesPDF, `${currReportFile} -> Amazon Expenses - Liquidations fees: API ${expensesLiquidationsFeesAPI} should equal PDF ${expensesLiquidationsFeesPDF}`);
			})
		}
	})

	it(`should calculate Total Sum discrepancy and Max discrepancy`, () => {
		let discrepancyAllTotalSum = `Total discrepancy: ${Cypress.env('discrepancyTotalSum')[0]}`
		let discrepancyAllMaxWithName = Cypress.env('discrepancyMaxWithName').find(elem => elem.includes(Cypress.env('discrepancyAllMaxArr')[0]))

		// console.log(discrepancyAllTotalSum);
		// console.log(discrepancyAllMaxWithName);

		softAssert(discrepancyAllTotalSum === 0, `${discrepancyAllTotalSum}`)
		softAssert(discrepancyAllMaxWithName === 0, `${discrepancyAllMaxWithName}`)
	})
})