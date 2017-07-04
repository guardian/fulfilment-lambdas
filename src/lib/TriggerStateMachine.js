import AWS from 'aws-sdk'
const stepfunctions = new AWS.StepFunctions()

function getParams (input, stateMachineArn) {
  let params = {}
  params.stateMachineArn = stateMachineArn
  params.input = input
  return params
}


export function triggerStateMachine (input, stateMachineArn) {
  return new Promise((resolve, reject) => {
    stepfunctions.startExecution(getParams(input, stateMachineArn), function (err, data) {
      if (err) {
        console.log(err, err.stack)
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}