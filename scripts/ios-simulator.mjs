// Prints IOS_UDID, IOS_DEVICE and IOS_VERSION for the newest available iPhone simulator, in
// the KEY=value form that GitHub Actions reads from $GITHUB_ENV.
import { execFileSync } from 'node:child_process'

const { devices } = JSON.parse(
  execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], { encoding: 'utf8' }),
)
const version = (runtime) => runtime.split('.SimRuntime.iOS-')[1].split('-').map(Number)
const newer = (a, b) => version(b)[0] - version(a)[0] || (version(b)[1] || 0) - (version(a)[1] || 0)
const runtime = Object.keys(devices)
  .filter(
    (id) => id.includes('.SimRuntime.iOS-') && devices[id].some(({ name }) => /^iPhone/.test(name)),
  )
  .sort(newer)[0]
if (!runtime) throw new Error('No iPhone simulator is available')
const phones = devices[runtime].filter(({ name }) => /^iPhone/.test(name))
const device = phones.find(({ name }) => /^iPhone \d+$/.test(name)) || phones[0]
console.log(`IOS_UDID=${device.udid}`)
console.log(`IOS_DEVICE=${device.name}`)
console.log(`IOS_VERSION=${version(runtime).join('.')}`)
