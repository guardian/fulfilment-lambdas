/* eslint-env jest */
import { getDeliveryDate } from '../../src/weekly/WeeklyInput'
import moment from 'moment'

var MockDate = require('mockdate')

test('delivery date next week\'s friday', done => {
// mock current date..
  MockDate.set('11/07/2017')

  let input = {
    deliveryDayOfWeek: 'friday',
    minDaysInAdvance: 8
  }
  let expectedDeliveryDate = moment('2017-11-17', 'YYYY-MM-DD')
  let deliveryDate = getDeliveryDate(input)
  expect(deliveryDate.format()).toEqual(expectedDeliveryDate.format())
  done()
})

test('should generate a for the exact minDaysInAdvance if it is the correct day of the week', done => {
// mock current date..
  MockDate.set('11/09/2017')

  let input = {
    deliveryDayOfWeek: 'friday',
    minDaysInAdvance: 8
  }
  let expectedDeliveryDate = moment('2017-11-17', 'YYYY-MM-DD')
  let deliveryDate = getDeliveryDate(input)
  expect(deliveryDate.format()).toEqual(expectedDeliveryDate.format())
  done()
})
test('should generate a file 2 weeks in advance if the next 2 delivery dates closer than the minDaysInAdvance value', done => {
// mock current date..
  MockDate.set('11/10/2017') // set the date to a friday

  let input = {
    deliveryDayOfWeek: 'friday',
    minDaysInAdvance: 8
  }
  let expectedDeliveryDate = moment('2017-11-24', 'YYYY-MM-DD')
  let deliveryDate = getDeliveryDate(input)
  expect(deliveryDate.format()).toEqual(expectedDeliveryDate.format())
  done()
})

test('should generate a file on sunday', done => {
// mock current date..
  MockDate.set('11/08/2017')

  let input = {
    deliveryDayOfWeek: 'sunday',
    minDaysInAdvance: 8
  }
  let expectedDeliveryDate = moment('2017-11-19', 'YYYY-MM-DD')
  let deliveryDate = getDeliveryDate(input)
  expect(deliveryDate.format()).toEqual(expectedDeliveryDate.format())
  done()
})
