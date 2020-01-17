export default class NamedError extends Error {
  constructor (name, message) {
    super(message)
    this.name = name
    this.message = message
  }
}
