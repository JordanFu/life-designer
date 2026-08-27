import { expect, test } from '@playwright/test'

test('returns to the exact next question after closing the page', async ({ context, page }) => {
  await page.goto('/')
  await page.getByLabel('你的回答').fill('健康 6，工作 3，娱乐 4，爱 8。')
  await page.getByRole('button', { name: '保存并继续' }).click()
  await expect(page.getByRole('heading', { name: /此刻你最想解决/ })).toBeVisible()

  await page.close()
  const resumed = await context.newPage()
  await resumed.goto('/')

  await expect(resumed.getByText('健康 6，工作 3，娱乐 4，爱 8。')).toBeVisible()
  await expect(resumed.getByRole('heading', { name: /此刻你最想解决/ })).toBeVisible()
  await expect(resumed.getByText(/如果给健康/)).toHaveCount(0)
})
