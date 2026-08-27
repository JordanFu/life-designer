import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function submitText(page: Page, text: string, nextStep: number) {
  await page.getByLabel('你的回答').fill(text)
  await page.getByRole('button', { name: '保存并继续' }).click()
  await expect(page.getByText(`第 ${nextStep} 步，共 8 步`)).toBeVisible()
}

test('completes the guided journey, resumes exactly, and exports safe materials', async ({
  context,
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '先不用想清楚答案' })).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '导出人生设计素材' })).toHaveCount(0)

  await page.getByRole('button', { name: '开始看看' }).click()
  await expect(page.getByRole('heading', { name: '四个方面，先凭直觉看一眼' })).toBeVisible()
  await page.getByRole('slider', { name: '健康' }).fill('7')
  await page.getByRole('slider', { name: '工作' }).fill('2')
  await page.getByRole('slider', { name: '娱乐' }).fill('5')
  await page.getByRole('slider', { name: '爱' }).fill('8')
  await page.getByRole('button', { name: '看看哪里值得先聊' }).click()
  await expect(page.getByRole('heading', { name: '这次先谈哪一个？' })).toBeVisible()

  await page.close()
  const resumed = await context.newPage()
  await resumed.goto('/')
  await expect(resumed.getByRole('heading', { name: '这次先谈哪一个？' })).toBeVisible()
  await expect(resumed.getByRole('progressbar', { name: '第一阶段进度' })).toHaveAttribute(
    'aria-valuenow',
    '3',
  )
  await resumed.getByRole('button', { name: /工作.*建议先看/ }).click()

  await expect(resumed.getByRole('heading', { name: '哪句话更像你的困扰？' })).toBeVisible()
  await resumed.getByRole('button', { name: /想换方向但不知道去哪/ }).click()
  await resumed
    .getByLabel('把困扰说成一句自己的话')
    .fill('最近我最困扰的是：想换方向，但不知道该往哪里走。')
  await resumed.getByRole('button', { name: '继续，找一个真实时刻' }).click()

  await resumed.getByRole('button', { name: /^这周/ }).click()
  await expect(resumed.getByRole('heading', { name: '当时具体发生了什么？' })).toBeVisible()
  await resumed
    .getByLabel('那个时刻发生了什么')
    .fill('周一讨论下一季度项目时，我发现自己完全不想参与，也看不到继续做下去的意义。')
  await resumed.getByRole('button', { name: '继续，看看当时的感受' }).click()

  await resumed.getByRole('button', { name: '疲惫' }).click()
  await resumed.getByRole('button', { name: '迷茫' }).click()
  await resumed.getByRole('button', { name: '继续，分清哪些值得设计' }).click()

  await resumed.getByRole('button', { name: /这里面三种情况都有/ }).click()
  await resumed
    .getByLabel('我可以先做什么')
    .fill('约一位转过方向的朋友，聊聊他的真实工作日常和试错过程。')
  await resumed.getByRole('button', { name: '看看我听到了什么' }).click()

  await expect(resumed.getByRole('heading', { name: '我听到的是' })).toBeVisible()
  const reflection = resumed.getByLabel('第一阶段小结')
  await expect(reflection).toHaveValue(/我听到的是/)
  await reflection.fill(
    '我听到的是：我真正想处理的不是马上辞职，而是先获得关于新方向的真实信息。我愿意先做一次访谈验证。',
  )
  await resumed.getByRole('button', { name: '这基本准确，进入下一阶段' }).click()

  await expect(resumed.getByText('第 4 步，共 8 步')).toBeVisible()
  await expect(resumed.getByRole('heading', { name: '你的工作观' })).toBeVisible()
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
  expect(checkpoint.schemaVersion).toBe(3)
  expect(checkpoint.responses).toHaveLength(8)
  expect(checkpoint.stageReflections.here).toContain('一次访谈验证')
  expect(checkpoint.responses.find((item: { kind: string }) => item.kind === 'energy-map').events).toHaveLength(3)
  expect(checkpoint.responses.find((item: { kind: string }) => item.kind === 'odyssey-plans').plans).toHaveLength(3)
  expect(text).not.toMatch(/api[_-]?key|authorization|bearer/i)
})
