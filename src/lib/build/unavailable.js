// Replaces heavy optional modules in the lite build. The matching features are disabled,
// so these functions are only reached by direct calls that bypass the feature policy.
const unavailable = () => {
  throw new Error('This feature is not included in the studio-editor/lite build.')
}
export const equationSvg = unavailable
export const moleculeFromSmiles = unavailable
export const tidyMolecule = unavailable
export const convertToHtml = unavailable
export const images = { imgElement: unavailable }
export default { convertToHtml, images }
