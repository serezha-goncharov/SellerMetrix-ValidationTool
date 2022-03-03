/// <reference types="cypress" />
import { deleteDownloadsFolder } from '../plugins/utils'
const { softAssert, softExpect } = chai;

describe('Validation Tool', () => {

	before(deleteDownloadsFolder)
	let reportsFilesArr = [];

	it('should download all reports from cloud', () => {
		cy.visit(Cypress.env('googleDriveCloud'), { timeout: 10000 })
		cy.clearCookies()

		cy.get('div.iZmuQc').then(reports => {
			let reportsTotalAmount = reports.children('c-wiz').length
			let reportsNum = reportsTotalAmount - reportsTotalAmount

			downloadAllreports()
			function downloadAllreports() {
				if (reportsTotalAmount != reportsNum) {
					// Downloading each report
					cy.wrap(reports).children().eq(reportsNum).realHover().find('div.akerZd').realClick()
					// Verify each report is downloaded
					let dowloadedFileName = reports.children().eq(reportsNum).prop('innerText')
					cy.verifyDownload(dowloadedFileName, { timeout: 25000 })
					reportsFilesArr.push(dowloadedFileName)
					reportsNum++
					downloadAllreports()
				}
			}
			// Verify all report files are downloaded
			cy.task('countFiles', Cypress.config('downloadsFolder')).then(filesQuantity => {
				expect(filesQuantity).to.eq(reportsTotalAmount)
			})
			// console.log(reportsFilesArr);

			parseAllPDFReports()
			function parseAllPDFReports() {
				for (let i = 0; i < reportsFilesArr.length; i++) {
					cy.task('pdfToTable', reportsFilesArr[i]).then(content => {
						cy.log(`**${reportsFilesArr[i]}**`)
						let reportRows = content
						// console.log(reportRows);
						let substrDateRange = 'Account activity from'
						let reportDateRange = reportRows[35].find(element => {
							if (element.includes(substrDateRange)) {
								return true;
							}
						})

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

						let reportDateFrom = formatDate(reportDateFromTemp)
						let reportDateTo = formatDate(reportDateToTemp)
						// console.log(reportDateFrom);
						// console.log(reportDateTo);

						let incomeProductSalesNonFbaPDF = parseFloat(reportRows[2][1])
						let incomeProductSaleRefundsNonFbaPDF = parseFloat(reportRows[20][1])
						let incomeFbaProductSalesPDF = parseFloat(reportRows[36][1])
						let incomeFbaProductSaleRefundsPDF = parseFloat(reportRows[23][1])
						let incomeFbaInventoryCreditPDF = parseFloat(reportRows[24][1])
						let incomeFbaLiquidationProceedsPDF = parseFloat(reportRows[6][2])
						let incomeFbaLiquidationsProceedsAdjustmentsPDF = parseFloat(reportRows[3][3])
						let incomeShippingCreditsPDF = parseFloat(reportRows[3][2])
						let incomeShippingCreditRefundsPDF = parseFloat(reportRows[16][2])
						let incomeGiftWrapCreditsPDF = parseFloat(reportRows[21][1])
						let incomeGiftWrapCreditRefundsPDF = parseFloat(reportRows[19][3])
						let incomePromotionalRebatesPDF = parseFloat(reportRows[19][2])
						let incomePromotionalRebateRefundsPDF = parseFloat(reportRows[4][1])
						let incomeAToZGuaranteeClaimsPDF = parseFloat(reportRows[10][1])
						let incomeChargebacksPDF = parseFloat(reportRows[29][1])
						let incomeAmazonShippingReimbursementPDF = parseFloat(reportRows[14][1])
						let incomeSafeTReimbursementPDF = parseFloat(reportRows[9][1])
						let expensesSellerFulfilledSellingFeesPDF = parseFloat(reportRows[2][3])
						let expensesFbaSellingFeesPDF = parseFloat(reportRows[20][3])
						let expensesSellingFeeRefundsPDF = parseFloat(reportRows[23][5])
						let expensesFbaTransactionFeesPDF = parseFloat(reportRows[23][4])
						let expensesFbaTransactionFeeRefundsPDF = parseFloat(reportRows[6][6])
						let expensesOtherTransactionFeesPDF = parseFloat(reportRows[6][5])
						let expensesOtherTransactionFeeRefundsPDF = parseFloat(reportRows[3][5])
						let expensesFbaInventoryAndInboundServicesFeesPDF = parseFloat(reportRows[16][4])
						let expensesShippingLabelPurchasesPDF = parseFloat(reportRows[21][3])
						let expensesShippingLabelRefundsPDF = parseFloat(reportRows[19][5])
						let expensesCarrierShippingLabelAdjustmentsPDF = parseFloat(reportRows[4][5])
						let expensesServiceFeesPDF = parseFloat(reportRows[10][5])
						let expensesRefundAdministrationFeesPDF = parseFloat(reportRows[10][4])
						let expensesAdjustmentsPDF = parseFloat(reportRows[29][4])
						let expensesCostOfAdvertisingPDF = parseFloat(reportRows[14][4])
						let expensesRefundForAdvertiserPDF = parseFloat(reportRows[9][3])
						let expensesLiquidationsFeesPDF = parseFloat(reportRows[15][1])


						// Getting report ID according to the date range
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
								"from": `${reportDateFrom}`,
								"to": `${reportDateTo}`
							}
						}).then((response) => {
							let reportID = response.body

						})


						// Getting detailed report from API
						cy.request({
							method: 'GET',
							url: `${Cypress.env('serverAddress')}/api/v2/cached-reports/42387069094483380711236824913416233447
							`,
							headers: {
								'Authorization': `${Cypress.env('tokenJWT')}`,
								'Content-Type': 'application/json; charset=utf-8'
							}
						}).then((response) => {

							let incomeProductSalesNonFbaAPI = response.body.marketplaces[0].data['Income']['Product sales (non-FBA)'][reportDateTo]
							let incomeProductSaleRefundsNonFbaAPI = response.body.marketplaces[0].data['Income']['Product sale refunds (non-FBA)'][reportDateTo]
							let incomeFbaProductSalesAPI = response.body.marketplaces[0].data['Income']['FBA product sales'][reportDateTo]
							let incomeFbaProductSaleRefundsAPI = response.body.marketplaces[0].data['Income']['FBA product sale refunds'][reportDateTo]
							let incomeFbaInventoryCreditAPI = response.body.marketplaces[0].data['Income']['FBA inventory credit'][reportDateTo]
							let incomeFbaLiquidationProceedsAPI = response.body.marketplaces[0].data['Income']['FBA liquidation proceeds'][reportDateTo]
							let incomeFbaLiquidationsProceedsAdjustmentsAPI = response.body.marketplaces[0].data['Income']['FBA Liquidations proceeds adjustments'][reportDateTo]
							let incomeShippingCreditsAPI = response.body.marketplaces[0].data['Income']['Shipping credits'][reportDateTo]
							let incomeShippingCreditRefundsAPI = response.body.marketplaces[0].data['Income']['Shipping credit refunds'][reportDateTo]
							let incomeGiftWrapCreditsAPI = response.body.marketplaces[0].data['Income']['Gift wrap credits'][reportDateTo]
							let incomeGiftWrapCreditRefundsAPI = response.body.marketplaces[0].data['Income']['Gift wrap credit refunds'][reportDateTo]
							let incomePromotionalRebatesAPI = response.body.marketplaces[0].data['Income']['Promotional rebates'][reportDateTo]
							let incomePromotionalRebateRefundsAPI = response.body.marketplaces[0].data['Income']['Promotional rebate refunds'][reportDateTo]
							let incomeAToZGuaranteeClaimsAPI = response.body.marketplaces[0].data['Income']['A-to-z Guarantee claims'][reportDateTo]
							let incomeChargebacksAPI = response.body.marketplaces[0].data['Income']['Chargebacks'][reportDateTo]
							let incomeAmazonShippingReimbursementAPI = response.body.marketplaces[0].data['Income']['Amazon Shipping Reimbursement'][reportDateTo]
							let incomeSafeTReimbursementAPI = response.body.marketplaces[0].data['Income']['SAFE-T reimbursement'][reportDateTo]
							let expensesSellerFulfilledSellingFeesAPI = response.body.marketplaces[0].data['Amazon Expenses']['Seller fulfilled selling fees'][reportDateTo]
							let expensesFbaSellingFeesAPI = response.body.marketplaces[0].data['Amazon Expenses']['FBA selling fees'][reportDateTo]
							let expensesSellingFeeRefundsAPI = response.body.marketplaces[0].data['Amazon Expenses']['Selling fee refunds'][reportDateTo]
							let expensesFbaTransactionFeesAPI = response.body.marketplaces[0].data['Amazon Expenses']['FBA transaction fees'][reportDateTo]
							let expensesFbaTransactionFeeRefundsAPI = response.body.marketplaces[0].data['Amazon Expenses']['FBA transaction fee refunds'][reportDateTo]
							let expensesOtherTransactionFeesAPI = response.body.marketplaces[0].data['Amazon Expenses']['Other transaction fees'][reportDateTo]
							let expensesOtherTransactionFeeRefundsAPI = response.body.marketplaces[0].data['Amazon Expenses']['Other transaction fee refunds'][reportDateTo]
							let expensesFbaInventoryAndInboundServicesFeesAPI = response.body.marketplaces[0].data['Amazon Expenses']['FBA inventory and inbound services fees'][reportDateTo]
							let expensesShippingLabelPurchasesAPI = response.body.marketplaces[0].data['Amazon Expenses']['Shipping label purchases'][reportDateTo]
							let expensesShippingLabelRefundsAPI = response.body.marketplaces[0].data['Amazon Expenses']['Shipping label refunds'][reportDateTo]
							let expensesCarrierShippingLabelAdjustmentsAPI = response.body.marketplaces[0].data['Amazon Expenses']['Carrier shipping label adjustments'][reportDateTo]
							let expensesServiceFeesAPI = response.body.marketplaces[0].data['Amazon Expenses']['Service fees'][reportDateTo]
							let expensesRefundAdministrationFeesAPI = response.body.marketplaces[0].data['Amazon Expenses']['Refund administration fees'][reportDateTo]
							let expensesAdjustmentsAPI = response.body.marketplaces[0].data['Amazon Expenses']['Adjustments'][reportDateTo]
							let expensesCostOfAdvertisingAPI = response.body.marketplaces[0].data['Amazon Expenses']['Cost of Advertising'][reportDateTo]
							let expensesRefundForAdvertiserAPI = response.body.marketplaces[0].data['Amazon Expenses']['Refund for Advertiser'][reportDateTo]
							let expensesLiquidationsFeesAPI = response.body.marketplaces[0].data['Amazon Expenses']['Liquidations fees'][reportDateTo]

							expect(response.status).equal(200)
							expect(response.body).not.empty
							softAssert(incomeProductSalesNonFbaAPI === incomeProductSalesNonFbaPDF, `Income - Product sales (non-FBA): **API ${incomeProductSalesNonFbaAPI}** should equal **PDF ${incomeProductSalesNonFbaPDF}**`);
							softAssert(incomeProductSaleRefundsNonFbaAPI === incomeProductSaleRefundsNonFbaPDF, `Income - Product sales (non-FBA): **API ${incomeProductSaleRefundsNonFbaAPI}** should equal **PDF ${incomeProductSaleRefundsNonFbaPDF}**`);
							softAssert(incomeFbaProductSalesAPI === incomeFbaProductSalesPDF, `Income - FBA product sales: **API ${incomeFbaProductSalesAPI}** should equal **PDF ${incomeFbaProductSalesPDF}**`);
							softAssert(incomeFbaProductSaleRefundsAPI === incomeFbaProductSaleRefundsPDF, `Income - FBA product sale refunds: **API ${incomeFbaProductSaleRefundsAPI}** should equal **PDF ${incomeFbaProductSaleRefundsPDF}**`);
							softAssert(incomeFbaInventoryCreditAPI === incomeFbaInventoryCreditPDF, `Income - FBA inventory credit: **API ${incomeFbaInventoryCreditAPI}** should equal **PDF ${incomeFbaInventoryCreditPDF}**`);
							softAssert(incomeFbaLiquidationProceedsAPI === incomeFbaLiquidationProceedsPDF, `Income - FBA liquidation proceeds: **API ${incomeFbaLiquidationProceedsAPI}** should equal **PDF ${incomeFbaLiquidationProceedsPDF}**`);
							softAssert(incomeFbaLiquidationsProceedsAdjustmentsAPI === incomeFbaLiquidationsProceedsAdjustmentsPDF, `Income - FBA Liquidations proceeds adjustments: **API ${incomeFbaLiquidationsProceedsAdjustmentsAPI}** should equal **PDF ${incomeFbaLiquidationsProceedsAdjustmentsPDF}**`);
							softAssert(incomeShippingCreditsAPI === incomeShippingCreditsPDF, `Income - Shipping credits: **API ${incomeShippingCreditsAPI}** should equal **PDF ${incomeShippingCreditsPDF}**`);
							softAssert(incomeShippingCreditRefundsAPI === incomeShippingCreditRefundsPDF, `Income - Shipping credit refunds: **API ${incomeShippingCreditRefundsAPI}** should equal **PDF ${incomeShippingCreditRefundsPDF}**`);
							softAssert(incomeGiftWrapCreditsAPI === incomeGiftWrapCreditsPDF, `Income - Gift wrap credits: **API ${incomeGiftWrapCreditsAPI}** should equal **PDF ${incomeGiftWrapCreditsPDF}**`);
							softAssert(incomeGiftWrapCreditRefundsAPI === incomeGiftWrapCreditRefundsPDF, `Income - Gift wrap credit refunds: **API ${incomeGiftWrapCreditRefundsAPI}** should equal **PDF ${incomeGiftWrapCreditRefundsPDF}**`);
							softAssert(incomePromotionalRebatesAPI === incomePromotionalRebatesPDF, `Income - Promotional rebates: **API ${incomePromotionalRebatesAPI}** should equal **PDF ${incomePromotionalRebatesPDF}**`);
							softAssert(incomePromotionalRebateRefundsAPI === incomePromotionalRebateRefundsPDF, `Income - Promotional rebate refunds: **API ${incomePromotionalRebateRefundsAPI}** should equal **PDF ${incomePromotionalRebateRefundsPDF}**`);
							softAssert(incomeAToZGuaranteeClaimsAPI === incomeAToZGuaranteeClaimsPDF, `Income - A-to-z Guarantee claims: **API ${incomeAToZGuaranteeClaimsAPI}** should equal **PDF ${incomeAToZGuaranteeClaimsPDF}**`);
							softAssert(incomeChargebacksAPI === incomeChargebacksPDF, `Income - Chargebacks: **API ${incomeChargebacksAPI}** should equal **PDF ${incomeChargebacksPDF}**`);
							softAssert(incomeAmazonShippingReimbursementAPI === incomeAmazonShippingReimbursementPDF, `Income - Amazon Shipping Reimbursement: **API ${incomeAmazonShippingReimbursementAPI}** should equal **PDF ${incomeAmazonShippingReimbursementPDF}**`);
							softAssert(incomeSafeTReimbursementAPI === incomeSafeTReimbursementPDF, `Income - SAFE-T reimbursement: **API ${incomeSafeTReimbursementAPI}** should equal **PDF ${incomeSafeTReimbursementPDF}**`);
							softAssert(expensesSellerFulfilledSellingFeesAPI === expensesSellerFulfilledSellingFeesPDF, `Amazon Expenses - Seller fulfilled selling fees: **API ${expensesSellerFulfilledSellingFeesAPI}** should equal **PDF ${expensesSellerFulfilledSellingFeesPDF}**`);
							softAssert(expensesFbaSellingFeesAPI === expensesFbaSellingFeesPDF, `Amazon Expenses - FBA selling fees: **API ${expensesFbaSellingFeesAPI}** should equal **PDF ${expensesFbaSellingFeesPDF}**`);
							softAssert(expensesSellingFeeRefundsAPI === expensesSellingFeeRefundsPDF, `Amazon Expenses - Selling fee refunds: **API ${expensesSellingFeeRefundsAPI}** should equal **PDF ${expensesSellingFeeRefundsPDF}**`);
							softAssert(expensesFbaTransactionFeesAPI === expensesFbaTransactionFeesPDF, `Amazon Expenses - FBA transaction fees: **API ${expensesFbaTransactionFeesAPI}** should equal **PDF ${expensesFbaTransactionFeesPDF}**`);
							softAssert(expensesFbaTransactionFeeRefundsAPI === expensesFbaTransactionFeeRefundsPDF, `Amazon Expenses - FBA transaction fee refunds: **API ${expensesFbaTransactionFeeRefundsAPI}** should equal **PDF ${expensesFbaTransactionFeeRefundsPDF}**`);
							softAssert(expensesOtherTransactionFeesAPI === expensesOtherTransactionFeesPDF, `Amazon Expenses - Other transaction fees: **API ${expensesOtherTransactionFeesAPI}** should equal **PDF ${expensesOtherTransactionFeesPDF}**`);
							softAssert(expensesOtherTransactionFeeRefundsAPI === expensesOtherTransactionFeeRefundsPDF, `Amazon Expenses - Other transaction fee refunds: **API ${expensesOtherTransactionFeeRefundsAPI}** should equal **PDF ${expensesOtherTransactionFeeRefundsPDF}**`);
							softAssert(expensesFbaInventoryAndInboundServicesFeesAPI === expensesFbaInventoryAndInboundServicesFeesPDF, `Amazon Expenses - FBA inventory and inbound services fees: **API ${expensesFbaInventoryAndInboundServicesFeesAPI}** should equal **PDF ${expensesFbaInventoryAndInboundServicesFeesPDF}**`);
							softAssert(expensesShippingLabelPurchasesAPI === expensesShippingLabelPurchasesPDF, `Amazon Expenses - Shipping label purchases: **API ${expensesShippingLabelPurchasesAPI}** should equal **PDF ${expensesShippingLabelPurchasesPDF}**`);
							softAssert(expensesShippingLabelRefundsAPI === expensesShippingLabelRefundsPDF, `Amazon Expenses - Shipping label refunds: **API ${expensesShippingLabelRefundsAPI}** should equal **PDF ${expensesShippingLabelRefundsPDF}**`);
							softAssert(expensesCarrierShippingLabelAdjustmentsAPI === expensesCarrierShippingLabelAdjustmentsPDF, `Amazon Expenses - Carrier shipping label adjustments: **API ${expensesCarrierShippingLabelAdjustmentsAPI}** should equal **PDF ${expensesCarrierShippingLabelAdjustmentsPDF}**`);
							softAssert(expensesServiceFeesAPI === expensesServiceFeesPDF, `Amazon Expenses - Service fees: **API ${expensesServiceFeesAPI}** should equal **PDF ${expensesServiceFeesPDF}**`);
							softAssert(expensesRefundAdministrationFeesAPI === expensesRefundAdministrationFeesPDF, `Amazon Expenses - Refund administration fees: **API ${expensesRefundAdministrationFeesAPI}** should equal **PDF ${expensesRefundAdministrationFeesPDF}**`);
							softAssert(expensesAdjustmentsAPI === expensesAdjustmentsPDF, `Amazon Expenses - Adjustments: **API ${expensesAdjustmentsAPI}** should equal **PDF ${expensesAdjustmentsPDF}**`);
							softAssert(expensesCostOfAdvertisingAPI === expensesCostOfAdvertisingPDF, `Amazon Expenses - Cost of Advertising: **API ${expensesCostOfAdvertisingAPI}** should equal **PDF ${expensesCostOfAdvertisingPDF}**`);
							softAssert(expensesRefundForAdvertiserAPI === expensesRefundForAdvertiserPDF, `Amazon Expenses - Refund for Advertiser: **API ${expensesRefundForAdvertiserAPI}** should equal **PDF ${expensesRefundForAdvertiserPDF}**`);
							softAssert(expensesLiquidationsFeesAPI === expensesLiquidationsFeesPDF, `Amazon Expenses - Liquidations fees: **API ${expensesLiquidationsFeesAPI}** should equal **PDF ${expensesLiquidationsFeesPDF}**`);
						})
					})
				}
			}
		})
		cy.clearCookies()
	})
})