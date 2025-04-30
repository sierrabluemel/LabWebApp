export const round = (float, digits = 2) => {
  let number = Number((Math.abs(float) * 10 ** digits).toPrecision(12));
  return Math.round(number) / 10 ** digits * Math.sign(float);
}

export const sum = (array) => {
  return array.reduce((a, b) => a + b);
}

export const average = (array) => {
  return sum(array) / array.length;
}

export const standardDeviation = (array) => {
  const dataAverage = average(array);
  const squaredDifferences = array.map(dataPoint => {
    const difference = dataPoint - dataAverage;
    return difference * difference;
  })
  const averageDifference = sum(squaredDifferences) / (squaredDifferences.length - 1)
  
  return Math.sqrt(averageDifference);
}