import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function submitText(page: Page, text: string, nextStep: number) {
  await page.getByLabel('你的回答').fill(text)
  await page.getByRole('button', { name: '保存并继续' }).click()
  await expect(page.getByText(`第 ${nextStep} 步，共 8 步`)).toBeVisible()
}

test('completes the mixed journey, resumes exactly, and exports safe materials', async ({
  context,
  page,
}) => {
  await page.goto('/')
  await expect(page.getByText('第 1 步，共 8 步')).toBeVisible()
  await expect(page.getByRole('button', { name: '导出人生设计素材' })).toHaveCount(0)

  await page.getByLabel('工作').fill('3')
  await page.getByRole('button', { name: '保存并继续' }).click()
  await expect(page.getByText('第 2 步，共 8 步')).toBeVisible()

  await page.close()
  const resumed = await context.newPage()
  await resumed.goto('/')
  await expect(resumed.getByText('第 2 步，共 8 步')).toBeVisible()
  await expect(resumed.getByRole('heading', { name: '此刻最想解决的问题' })).toBeVisible()

  await submitText(resumed, '我想摆脱持续透支、却看不到意义的工作状态。', 3)
  await submitText(resumed, '上周连续加班后，我发现自己连周末也无法恢复。', 4)
  await submitText(resumed, '工作意味着创造价值、保持经济自主，也应该让我持续成长。', 5)
  await submitText(resumed, '我希望这一生有真实连接、有创造，也有选择如何使用时间的自由。', 6)

  for (const index of [1, 2, 3]) {
    await resumed
      .getByRole('textbox', { name: `活动 ${index}`, exact: true })
      .fill(`让我观察能量变化的具体活动 ${index}`)
  }
  await resumed.getByLabel('活动 1 的能量').selectOption('gain')
  await resumed.getByLabel('活动 2 的能量').selectOption('drain')
  await resumed.getByRole('button', { name: '保存并继续' }).click()
  await expect(resumed.getByText('第 7 步，共 8 步')).toBeVisible()

  for (const index of [1, 2, 3]) {
    await resumed.getByLabel(`方案 ${index} 标题`).fill(`人生版本 ${index}`)
    await resumed
      .getByLabel(`方案 ${index} 理想画面`)
      .fill(`这是第 ${index} 个我真心愿意尝试、并且可以用五年展开的生活画面。`)
    await resumed.getByLabel(`方案 ${index} 工作里程碑`).fill(`工作里程碑 ${index}`)
    await resumed.getByLabel(`方案 ${index} 个人里程碑`).fill(`个人里程碑 ${index}`)
  }
  await expect(resumed.getByRole('button', { name: '导出人生设计素材' })).toHaveCount(0)
  await resumed.getByRole('button', { name: '保存并继续' }).click()
  await expect(resumed.getByText('第 8 步，共 8 步')).toBeVisible()
  await expect(resumed.getByRole('button', { name: '导出人生设计素材' })).toHaveCount(0)

  await resumed.getByLabel('方案 2').check()
  await resumed.getByLabel('体验实验').check()
  await resumed.getByLabel('具体行动').fill('跟随一位目标领域从业者体验半天真实工作。')
  await resumed.getByLabel('计划时间').fill('本月第二个周六')
  await resumed.getByRole('button', { name: '保存并继续' }).click()

  await expect(resumed.getByRole('heading', { name: '现在才到了生成蓝图的起点。' })).toBeVisible()
  const downloadPromise = resumed.waitForEvent('download')
  await resumed.getByRole('button', { name: '导出人生设计素材' }).click()
  const download = await downloadPromise
  const path = await download.path()
  expect(path).not.toBeNull()

  const text = await readFile(path as string, 'utf8')
  const checkpoint = JSON.parse(text)
  expect(checkpoint.schemaVersion).toBe(2)
  expect(checkpoint.responses).toHaveLength(8)
  expect(checkpoint.responses.find((item: { kind: string }) => item.kind === 'energy-map').events).toHaveLength(3)
  expect(checkpoint.responses.find((item: { kind: string }) => item.kind === 'odyssey-plans').plans).toHaveLength(3)
  expect(text).not.toMatch(/api[_-]?key|authorization|bearer/i)
})
