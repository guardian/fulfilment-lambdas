/* eslint-env jest */
import { csvFormatterForSalesforce, formatDeliveryInstructions } from '../../src/lib/formatters'
import getStream from 'get-stream'
import { stripIndents } from 'common-tags'
import { outputHeaders as gwOutputHeaders } from '../../src/weekly/WeeklyExporter'
import { outputHeaders as hdOutputHeaders } from '../../src/homedelivery/export'
import la from 'lodash/array'

test('should format delivery instructions for Salesforce CSV parser', () => {
  const deliveryInstructions = 'front door is on ""Foo\'s Drive "",Put though the letterbox, do not leave on door step.'
  const expected = 'front door is on \'Foo\'s Drive \',Put though the letterbox, do not leave on door step.'
  expect(formatDeliveryInstructions(deliveryInstructions)).toEqual(expected)
})

test('output format for Salesforce CSV parser', async () => {
  const csvStream = csvFormatterForSalesforce(['header1', 'header2'])

  csvStream.write({ header1: 'row1-col1', header2: '"row1-col2"' })
  csvStream.write({ header1: 'Foo 11/00, ABCD PPP 00', header2: 'row3-col2' })
  csvStream.write({ header1: 'front door is on "Foo\'s Drive ",Put though the letterbox, do not leave on door step.', header2: 'row4-col2' })
  csvStream.write({ header1: 'Foo "7" Bar', header2: 'row4-col2' })
  csvStream.write({ header1: 'Foo "7", Bar', header2: 'row5-col2' })
  csvStream.end()

  const streamAsString = await getStream(csvStream)

  expect(streamAsString).toEqual(stripIndents`
    "header1","header2"
    "row1-col1","""row1-col2"""
    "Foo 11/00, ABCD PPP 00","row3-col2"
    "front door is on ""Foo's Drive "",Put though the letterbox, do not leave on door step.","row4-col2"
    "Foo ""7"" Bar","row4-col2"
    "Foo ""7"", Bar","row5-col2"
  `)
})

test('guardian weekly output format for Salesforce CSV parser', async () => {
  const csvStream = csvFormatterForSalesforce(gwOutputHeaders)
  const row = la.zipObject(
    gwOutputHeaders,
    ['A-S00000000', 'Foo Bar', '', 'Level 43 234 Foo St', 'Foo "Bar", (Zar)', '', 'UNITED KINGDOM', 'ABC CBA', '1.0']
  )
  csvStream.write(row)
  csvStream.end()
  await expect(getStream(csvStream)).resolves.toEqual(stripIndents`
    "Subscriber ID","Name","Company name","Address 1","Address 2","Address  3","Country","Post code","Copies"
    "A-S00000000","Foo Bar","","Level 43 234 Foo St","Foo ""Bar"", (Zar)","","UNITED KINGDOM","ABC CBA","1.0"
  `)
})

test('home delivery output format for Salesforce CSV parser', async () => {
  const csvStream = csvFormatterForSalesforce(hdOutputHeaders)
  const row = la.zipObject(
    hdOutputHeaders,
    ['A-S00000000', '', 'Foo Bar', '', '', '', '11 Foo Bar,Pimlico', 'Foo Bar 1', '', 'Foo Bar', 'AAA BBB', '1', '+440101010101', '', '', '', '', '', '', 'front door is on "Foo Bar",Put though the letterbox, do not leave on door step.', '', '', '19/01/2021', '20/01/2021', '', '', '', 'Monday']
  )
  csvStream.write(row)
  csvStream.end()
  await expect(getStream(csvStream)).resolves.toEqual(stripIndents`
    "Customer Reference","Contract ID","Customer Full Name","Customer Job Title","Customer Company","Customer Department","Customer Address Line 1","Customer Address Line 2","Customer Address Line 3","Customer Town","Customer PostCode","Delivery Quantity","Customer Telephone","Property type","Front Door Access","Door Colour","House Details","Where to Leave","Landmarks","Additional Information","Letterbox","Source campaign","Sent Date","Delivery Date","Returned Date","Delivery problem","Delivery problem notes","Charge day"
    "A-S00000000","","Foo Bar","","","","11 Foo Bar,Pimlico","Foo Bar 1","","Foo Bar","AAA BBB","1","+440101010101","","","","","","","front door is on ""Foo Bar"",Put though the letterbox, do not leave on door step.","","","19/01/2021","20/01/2021","","","","Monday"
  `)
})
