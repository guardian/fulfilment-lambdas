/* eslint-env jest */
import { formatDeliveryInstructions } from '../../src/lib/formatters'

test('should format delivery instructions for Salesforce CSV parser', () => {
  const deliveryInstructions = 'front door is on ""Foo\'s Drive "",Put though the letterbox, do not leave on door step.'
  const expected = 'front door is on \'Foo\'s Drive \',Put though the letterbox, do not leave on door step.'
  expect(formatDeliveryInstructions(deliveryInstructions)).toEqual(expected)
})
