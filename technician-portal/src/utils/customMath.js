export const round = (float, digits = 2) => {
  let number = Number((Math.abs(float) * 10 ** digits).toPrecision(12));
  return Math.round(number) / 10 ** digits * Math.sign(float);
}

export const sum = (numberArray) => {
  return numberArray.reduce((a, b) => a + b);
}

export const average = (numberArray) => {
  return sum(numberArray) / numberArray.length;
}

export const standardDeviation = (numberArray, minimumLength=0) => {
  if (numberArray.length < minimumLength)
    throw new Error(`numberArray has too few entries for standardDeviation: ${numberArray.length} minimum: ${minimumLength}`)
  const dataAverage = average(numberArray);
  const squaredDifferences = numberArray.map(dataPoint => {
    const difference = dataPoint - dataAverage;
    return difference * difference;
  })
  const averageDifference = sum(squaredDifferences) / (squaredDifferences.length - 1)
  
  return Math.sqrt(averageDifference);
}

export const truncateDecimals = (num, digits) => {
  const numString = num.toString();
  const decimalPos = numString.indexOf('.');
  const subStringLength = decimalPos === -1 ? numString.length : 1 + decimalPos + digits;
  const trimmedResult = numString.substr(0, subStringLength);
  const finalResult = isNaN(trimmedResult) ? 0 : trimmedResult;

  return parseFloat(finalResult);
}

const getDecimalsOfPrecision = (num, precision=2) => {
  const precisionString = num.toPrecision(precision).toString();
  const splitString = precisionString.split('.')
  
  return splitString.length > 1 ? splitString[1].length : 0;
}

export const getUncertainty = (variances, expanded = true) => {
  variances[variances.length-1] = truncateDecimals(variances[variances.length-1], getDecimalsOfPrecision(variances[variances.length-1]))
  const varianceSum = sum(variances);
  const decimalsToTruncate = getDecimalsOfPrecision(varianceSum);
  const truncatedSum = truncateDecimals(varianceSum, decimalsToTruncate);
  const squareRoot = Math.sqrt(truncatedSum);
  const uncertainty = squareRoot.toPrecision(2);

  return expanded ? uncertainty*2 : uncertainty;
}