#!/bin/bash

# Guardian Weekly fulfilment CSV files are scattered across multiple S3 folders,
# so this script constructs a single file locally. The script also prints the number
# of subscriptions with duplicate entries.
# 
# Example usage:
#  ./get-guardian-weekly-fulfilment-file.sh 2019-01-04
#  totalRecordsCount =    38229
#  subsWithDuplicatesCount =       52

DELIVERY_DATE=$1

function checkPreconditions() {
  if [[ -z "${DELIVERY_DATE}" ]]; then
    echo >&2 "ERROR: You need to provide delivery date in the format YYYY-MM-DD"; exit 1;
  fi

  command -v guniq 1>/dev/null 2>&1 || { echo >&2 "ERROR: Cannot find guniq. Please install with 'brew install coreutils'. Aborting."; exit 1; }

  aws --profile membership s3 ls "s3://fulfilment-export-prod" 1>/dev/null 2>&1
  if [[ $? -gt 0 ]]; then
    echo "ERROR: You do not have access to membership AWS account. Make sure you have fresh credentials from Janus."
    exit 2
  fi
}

function getSingleGuardianWeeklyFulfilmentCSVFile() {
  filename=${DELIVERY_DATE}_WEEKLY.csv
  touch ${filename}
  S3_GW_BUCKET="s3://fulfilment-export-prod/fulfilments"

  aws s3 cp --profile membership "${S3_GW_BUCKET}/Weekly_AU/${filename}" - >${filename}
  aws s3 cp --profile membership "${S3_GW_BUCKET}/Weekly_CA/${filename}" - | tail -n +2 >>${filename}
  aws s3 cp --profile membership "${S3_GW_BUCKET}/Weekly_CA_HAND/${filename}" - | tail -n +2 >>${filename}
  aws s3 cp --profile membership "${S3_GW_BUCKET}/Weekly_FR/${filename}" - | tail -n +2 >>${filename}
  aws s3 cp --profile membership "${S3_GW_BUCKET}/Weekly_HK/${filename}" - | tail -n +2 >>${filename}
  aws s3 cp --profile membership "${S3_GW_BUCKET}/Weekly_NZ/${filename}" - | tail -n +2 >>${filename}
  aws s3 cp --profile membership "${S3_GW_BUCKET}/Weekly_ROW/${filename}" - | tail -n +2 >>${filename}
  aws s3 cp --profile membership "${S3_GW_BUCKET}/Weekly_UK/${filename}" - | tail -n +2 >>${filename}
  aws s3 cp --profile membership "${S3_GW_BUCKET}/Weekly_US/${filename}" - | tail -n +2 >>${filename}
  aws s3 cp --profile membership "${S3_GW_BUCKET}/Weekly_VU/${filename}" - | tail -n +2 >>${filename}
}

function printStats() {
  totalRecordsCount=`tail -n +2 ${filename} | wc -l`
  subsWithDuplicatesCount=`guniq -cd ${filename} | wc -l`

  echo "totalRecordsCount = ${totalRecordsCount}"
  echo "subsWithDuplicatesCount = ${subsWithDuplicatesCount}"
}

checkPreconditions
getSingleGuardianWeeklyFulfilmentCSVFile
printStats

