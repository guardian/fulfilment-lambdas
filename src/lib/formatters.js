export function formatPostCode (postCode: string) {
  /**
   * Supplier requirements:
   * 1) all caps
   * 2) space before final three chars
   */
  const normalised = postCode.replace(/ /g, '').toUpperCase()
  const length = normalised.length
  const outward = normalised.substring(0, length - 3)
  const inward = normalised.substring(length - 3)
  return `${outward} ${inward}`
}

/**
 * Replace double quotes " with single quotes ' because Salesforce CSV parser gets confused if it sees
 * double quites followed by a comma "", within the column value itself, for example:
 *
 * BEFORE:
 *  "front door is on ""Foo's Drive "",Put though the letterbox, do not leave on door step."
 *
 * AFTER:
 *  "front door is on 'Foo's Drive ',Put though the letterbox, do not leave on door step."
 *
 */
export function formatDeliveryInstructions (deliveryInstructions: string) {
  return deliveryInstructions.replace(/""/g, '\'')
}
