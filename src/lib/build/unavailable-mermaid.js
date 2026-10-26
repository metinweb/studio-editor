// Replaces Mermaid in studio-editor/lite, where the diagrams feature is disabled.
const unavailable = () => {
  throw new Error('Diagrams are not included in the studio-editor/lite build.')
}
export default { initialize: unavailable, parse: unavailable, render: unavailable }
