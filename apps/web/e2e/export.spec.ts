import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('exports three answers without credentials', async ({ page }) => {
  await page.goto('/')
  const answers = [
    '健康 6，工作 3，娱乐 4，爱 8。',
    '工作让我最焦虑。',
    '昨天又一次加班到深夜。',
  ]

  for (const answer of answers) {
    await page.getByLabel('你的回答').fill(answer)
    await page.getByRole('button', { name: '保存并继续' }).click()
  }

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载我的进度包' }).click()
  const download = await downloadPromise
  const path = await download.path()
  expect(path).not.toBeNull()

  const text = await readFile(path as string, 'utf8')
  const checkpoint = JSON.parse(text)
  expect(checkpoint.answers.map((item: { text: string }) => item.text)).toEqual(answers)
  expect(text).not.toMatch(/api[_-]?key|authorization|bearer/i)
})
