import { test, expect } from '@playwright/test'
import { cmsPremiumTests } from '../../tests/helpers/cms-premium.js'
cmsPremiumTests(test, expect)
