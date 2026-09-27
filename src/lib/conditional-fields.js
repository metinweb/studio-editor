export function readCondition(value) {
  try {
    const data = typeof value === 'string' ? JSON.parse(value) : value
    if (
      !data ||
      !/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(data.key || '') ||
      !['equals', 'notEmpty'].includes(data.operator) ||
      [data.match, data.yes, data.no].some((v) => typeof v !== 'string' || v.length > 2000)
    )
      return null
    return { key: data.key, operator: data.operator, match: data.match, yes: data.yes, no: data.no }
  } catch {
    return null
  }
}
export function conditionResult(condition, value) {
  const text = String(value ?? '')
  return (condition.operator === 'notEmpty' ? !!text.trim() : text === condition.match)
    ? condition.yes
    : condition.no
}
