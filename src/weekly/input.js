// @flow
import moment from 'moment'

type input = {
  deliveryDate: ?string,
  deliveryDayOfWeek: ?string,
  minDaysInAdvance: ?number
}

let weekDays:Map<string, number> = new Map([
  ['SUNDAY', 0],
  ['MONDAY', 1],
  ['TUESDAY', 2],
  ['WEDNESDAY', 3],
  ['THURSDAY', 4],
  ['FRIDAY', 5],
  ['SATURDAY', 6],
  ['SUN', 0],
  ['MON', 1],
  ['TUE', 2],
  ['WED', 3],
  ['THU', 4],
  ['FRI', 5],
  ['SAT', 6]
])

export function getDeliveryDate (input: input) {
  if (input.deliveryDate) {
    let deliveryDate = moment(input.deliveryDate, 'YYYY-MM-DD')
    if (!deliveryDate.isValid()) {
      throw new Error('deliveryDate must be in the format "YYYY-MM-DD"')
    } else {
      console.log(deliveryDate)
      console.log('is valid')
    }
    return deliveryDate
  }
  if (input.deliveryDayOfWeek && typeof input.minDaysInAdvance === 'number') {
    let dayOfWeek = input.deliveryDayOfWeek
    let minDaysInAdvance = input.minDaysInAdvance
    let dayOfWeekNum = weekDays.get(dayOfWeek.toUpperCase().trim())
    if (dayOfWeekNum === undefined || dayOfWeekNum == null) {
      throw new Error(`${dayOfWeek} is not a valid day of the week`)
    }
    let minDate = moment().startOf('day').add(minDaysInAdvance, 'days')
    let dayInWeek = minDate.clone().weekday(dayOfWeekNum)

    if (dayInWeek.isBefore(minDate)) {
      return dayInWeek.add(7, 'days')
    } else {
      return dayInWeek
    }
  }
  throw new Error('deliveryDate or (deliveryDayOfWeek and minDaysInAdvance) input params must be provided')
}