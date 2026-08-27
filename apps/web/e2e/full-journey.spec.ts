import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function submitText(page: Page, text: string, nextStep: number) {
  await page.getByLabel('你的回答').fill(text)
  await page.getByRole('button', { name: '保存并继续' }).click()
  await continueCoach(page)
  await expect(page.getByText(`第 ${nextStep} 步，共 8 步`)).toBeVisible()
}

async function continueCoach(page: Page) {
  await expect(page.getByText('来自本机 Codex 的人生设计回应')).toBeVisible()
  await expect(page.getByText('只追问一件事')).toBeVisible()
  await page.getByRole('button', { name: '继续下一步' }).click()
}

test('completes the guided journey, resumes exactly, and exports safe materials', async ({
  context,
  page,
}) => {
  let coachCalls = 0
  await context.route('**/api/codex/coach', async (route) => {
    coachCalls += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        acknowledgement: `你刚才完成了第 ${coachCalls} 个关键节点，而且提供了足够具体的真实素材。`,
        insight: '这里可能值得留意的是，你正在把模糊感受变成可以低成本验证的线索。',
        followUp: '最近哪一个具体时刻最能说明你刚才写下的内容？',
      }),
    })
  })
  const blueprintMarkdown = `# 我的人生设计蓝图

## 你在这里

你已经把模糊困扰落到了真实时刻和可以观察的生活结构中。

## 真问题

真正值得验证的不是立刻找到终身答案，而是下一种工作日常是否更适合你。

## 你的指南针

你的工作观重视创造、成长和经济自主；人生观重视真实连接与时间选择权。

## 你的能量地图

你需要继续观察哪些具体活动让你投入、回血或被抽干。

## 三个平等的五年版本

三个版本都是值得尝试的 A 计划，差别在于你下一步最想验证的生活环境。

## 当前优先原型

先完成一次目标领域访谈和一次半天工作体验，用真实信息替代想象。

## 失败免疫

${'每个原型都不是终身赌注，它只负责为下一步留下有用的信息。'.repeat(8)}`
  await context.route('**/api/codex/blueprint', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ title: '我的人生设计蓝图', markdown: blueprintMarkdown }),
    })
  })

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

  await expect(resumed.getByText('来自本机 Codex 的人生设计回应')).toBeVisible()
  await resumed.reload()
  await expect(resumed.getByText('来自本机 Codex 的人生设计回应')).toBeVisible()
  await resumed.getByRole('button', { name: '继续下一步' }).click()
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
  await continueCoach(resumed)
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
  await continueCoach(resumed)
  await expect(resumed.getByText('第 8 步，共 8 步')).toBeVisible()

  await resumed.getByLabel('方案 2').check()
  await resumed.getByLabel('体验实验').check()
  await resumed.getByLabel('具体行动').fill('跟随一位目标领域从业者体验半天真实工作。')
  await resumed.getByLabel('计划时间').fill('本月第二个周六')
  await resumed.getByRole('button', { name: '保存并继续' }).click()
  await continueCoach(resumed)

  expect(coachCalls).toBe(6)
  await expect(resumed.getByRole('heading', { name: '现在，把这些线索连成属于你的蓝图。' })).toBeVisible()
  await resumed.getByRole('button', { name: '生成我的人生设计蓝图' }).click()
  await expect(resumed.getByRole('heading', { name: '我的人生设计蓝图' })).toBeVisible()
  await expect(resumed.getByRole('heading', { name: '三个平等的五年版本' })).toBeVisible()
  await resumed.reload()
  await expect(resumed.getByRole('heading', { name: '我的人生设计蓝图' })).toBeVisible()

  const markdownDownloadPromise = resumed.waitForEvent('download')
  await resumed.getByRole('button', { name: '下载 Markdown' }).click()
  const markdownDownload = await markdownDownloadPromise
  expect(markdownDownload.suggestedFilename()).toBe('人生设计蓝图.md')
  const markdownPath = await markdownDownload.path()
  expect(await readFile(markdownPath as string, 'utf8')).toContain('失败免疫')

  const materialsDownloadPromise = resumed.waitForEvent('download')
  await resumed.getByRole('button', { name: '导出结构化素材' }).click()
  const materialsDownload = await materialsDownloadPromise
  const path = await materialsDownload.path()
  expect(path).not.toBeNull()

  const text = await readFile(path as string, 'utf8')
  const checkpoint = JSON.parse(text)
  expect(checkpoint.schemaVersion).toBe(4)
  expect(checkpoint.responses).toHaveLength(8)
  expect(checkpoint.coachTurns).toHaveLength(6)
  expect(checkpoint.blueprint.status).toBe('complete')
  expect(checkpoint.stageReflections.here).toContain('一次访谈验证')
  expect(checkpoint.responses.find((item: { kind: string }) => item.kind === 'energy-map').events).toHaveLength(3)
  expect(checkpoint.responses.find((item: { kind: string }) => item.kind === 'odyssey-plans').plans).toHaveLength(3)
  expect(text).not.toMatch(/api[_-]?key|authorization|bearer/i)
})
