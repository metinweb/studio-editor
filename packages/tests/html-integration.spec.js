import { test, expect } from '@playwright/test'
import { htmlIntegrationTests } from '../../tests/helpers/html-integration.js'
htmlIntegrationTests(test, expect)
