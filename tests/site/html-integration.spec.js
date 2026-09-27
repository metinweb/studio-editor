import { test, expect } from '@playwright/test'
import { htmlIntegrationTests } from '../helpers/html-integration.js'
htmlIntegrationTests(test, expect)
