import { Paragraph, PatchType, TableRow } from 'docx';
import {
  buildAlarmChartOption,
  buildStandardMarkLines,
  formatCycleValue,
  groupAlarmRows,
  shadingForCycleCell,
  stripYear,
  table_alarm,
  table_cyclecount_travelaccumulate,
  table_valves_health_month,
  table_valves_travel_month,
  textColorForShading,
} from './report.helper';
import type { ValveDetailItem } from './report.helper';

describe('buildAlarmChartOption', () => {
  const basePlot: NonNullable<ValveDetailItem['plot']> = {
    times: ['2025-05-15', '2025-06-15'],
    upperLimit: 5,
    lowerLimit: 1,
    dataLine: [0.19, 6.56],
    predictionLine: { linearRegression: [0.5, 6] },
    auxiliaryLine: { averageValue: [3.38, 3.38] },
  };

  it('yAxis.max is rounded UP to the next integer (B6)', () => {
    const opt = buildAlarmChartOption(basePlot);
    // raw max in dataLine is 6.56 → expect 7
    expect((opt.yAxis as { max: number }).max).toBe(7);
  });

  it('yAxis.min is rounded DOWN to the previous integer (B6)', () => {
    const opt = buildAlarmChartOption({
      ...basePlot,
      dataLine: [0.19, 6.56],
      lowerLimit: 0.5,
    });
    // raw min = min(0.19, 0.5) = 0.19 → expect 0
    expect((opt.yAxis as { min: number }).min).toBe(0);
  });

  it('series renders 标准线 → 平均值 → 预测线 → 数据线 (B8 data line on top)', () => {
    const opt = buildAlarmChartOption(basePlot);
    const series = opt.series as Array<{ name: string }>;
    expect(series.map((s) => s.name)).toEqual([
      '标准线',
      '平均值',
      '预测线',
      '数据线',
    ]);
  });

  it('legend label renames 辅助线 → 平均值 (B9)', () => {
    const opt = buildAlarmChartOption(basePlot);
    const legend = opt.legend as { data: string[] };
    expect(legend.data).toContain('平均值');
    expect(legend.data).not.toContain('辅助线');
  });

  it('series colors match frontend ECharts default palette by name (B7)', () => {
    // 前端 (client) ChartModal/workTable 不设 color, 用 ECharts 默认调色板,
    // 按前端 series 顺序 [数据线, 预测线, 辅助线, 标准线] = [蓝, 绿, 黄, 红]
    // PDF 这边 series 重排 (B8 为让数据线在最上层), 因此必须按 name 显式绑色
    const opt = buildAlarmChartOption(basePlot);
    const series = opt.series as Array<{
      name: string;
      itemStyle?: { color: string };
      lineStyle?: { color: string };
    }>;
    const byName = Object.fromEntries(series.map((s) => [s.name, s]));
    expect(byName['数据线'].itemStyle?.color).toBe('#5470c6'); // ECharts 默认 [0] 蓝
    expect(byName['预测线'].itemStyle?.color).toBe('#91cc75'); // ECharts 默认 [1] 绿
    expect(byName['平均值'].itemStyle?.color).toBe('#fac858'); // ECharts 默认 [2] 黄
    expect(byName['标准线'].itemStyle?.color).toBe('#ee6666'); // ECharts 默认 [3] 红
  });
});

describe('buildStandardMarkLines (任务 7/8/13)', () => {
  it('偏差类指标画 ± 双档 (行程偏差 [2,5] → ±2% / ±5%)', () => {
    expect(buildStandardMarkLines([2, 5], '行程偏差', '%')).toEqual([
      { name: '+2%', yAxis: 2 },
      { name: '-2%', yAxis: -2 },
      { name: '+5%', yAxis: 5 },
      { name: '-5%', yAxis: -5 },
    ]);
  });

  it('非偏差类只画正值 (行程累计器 [5,8] → 5%/次 与 8%/次)', () => {
    expect(buildStandardMarkLines([5, 8], '行程累计器', '%/次')).toEqual([
      { name: '5%/次', yAxis: 5 },
      { name: '8%/次', yAxis: 8 },
    ]);
  });

  it('单档也支持 (供气压力 [60] → 60kPa)', () => {
    expect(buildStandardMarkLines([60], '供气压力', 'kPa')).toEqual([
      { name: '60kPa', yAxis: 60 },
    ]);
  });

  it('无标准线 / 空数组 / 非数值 → 不画', () => {
    expect(buildStandardMarkLines(undefined, '行程', '%')).toEqual([]);
    expect(buildStandardMarkLines([], '行程', '%')).toEqual([]);
    expect(
      buildStandardMarkLines([NaN as number], '行程', '%'),
    ).toEqual([]);
  });
});

describe('buildAlarmChartOption metric awareness (任务 7/8/13)', () => {
  const basePlot: NonNullable<ValveDetailItem['plot']> = {
    times: ['t1', 't2'],
    upperLimit: 5,
    lowerLimit: 1,
    dataLine: [2, 3],
    predictionLine: { linearRegression: [2, 3] },
    auxiliaryLine: { averageValue: [2.5, 2.5] },
  };

  const markNames = (opt: ReturnType<typeof buildAlarmChartOption>) =>
    (
      opt.series as Array<{
        markLine?: { data: { name: string; yAxis: number }[] };
      }>
    )[0].markLine?.data.map((m) => m.name);

  it('标题 = 指标名 + 单位, Y 轴显示单位 (数据源下发)', () => {
    const opt = buildAlarmChartOption({
      ...basePlot,
      keywordName: '供气压力',
      unit: 'kPa',
    });
    expect((opt as { title?: { text: string } }).title?.text).toBe(
      '供气压力 (kPa)',
    );
    expect((opt.yAxis as { name?: string }).name).toBe('kPa');
  });

  it('只有指标名没有单位时, 标题不带括号', () => {
    const opt = buildAlarmChartOption({ ...basePlot, keywordName: '警报记录' });
    expect((opt as { title?: { text: string } }).title?.text).toBe('警报记录');
    expect((opt.yAxis as { name?: string }).name).toBeUndefined();
  });

  it('has no title / no unit when keywordName absent (backward compat)', () => {
    const opt = buildAlarmChartOption(basePlot);
    expect((opt as { title?: unknown }).title).toBeUndefined();
    expect((opt.yAxis as { name?: string }).name).toBeUndefined();
  });

  it('行程偏差 standardLine [2,5] → ±2%/±5% 双档 (任务 7)', () => {
    const opt = buildAlarmChartOption({
      ...basePlot,
      keywordName: '行程偏差',
      unit: '%',
      standardLine: [2, 5],
    });
    expect(markNames(opt)).toEqual(
      expect.arrayContaining(['下限值', '上限值', '+2%', '-2%', '+5%', '-5%']),
    );
  });

  it('行程累计器 standardLine [5,8] → 只画正值 (任务 8)', () => {
    const opt = buildAlarmChartOption({
      ...basePlot,
      keywordName: '行程累计器',
      unit: '%/次',
      standardLine: [5, 8],
    });
    const names = markNames(opt);
    expect(names).toEqual(
      expect.arrayContaining(['下限值', '上限值', '5%/次', '8%/次']),
    );
    expect(names).not.toContain('-8%/次');
  });

  it('expands yAxis range to cover standard lines (行程偏差 -5 < lowerLimit=1)', () => {
    const opt = buildAlarmChartOption({
      ...basePlot,
      keywordName: '行程偏差',
      unit: '%',
      standardLine: [2, 5],
    });
    // rawMin covers -5 → floor(-5) = -5
    expect((opt.yAxis as { min: number }).min).toBe(-5);
    expect((opt.yAxis as { max: number }).max).toBeGreaterThanOrEqual(5);
  });
});

describe('groupAlarmRows (B1)', () => {
  it('groups rows with same tag + same time into one group, preserving order', () => {
    const groups = groupAlarmRows([
      { tag: 'FV-3301-1', name: '问题A', description: '', time: '2025-05-15' },
      { tag: 'FV-3301-1', name: '问题B', description: '', time: '2025-05-15' },
      { tag: 'FV-3302', name: '问题C', description: '', time: '2025-05-15' },
      { tag: 'FV-3301-1', name: '问题D', description: '', time: '2025-06-15' },
    ]);
    expect(groups).toEqual([
      { tag: 'FV-3301-1', time: '2025-05-15', problems: ['问题A', '问题B'] },
      { tag: 'FV-3302', time: '2025-05-15', problems: ['问题C'] },
      { tag: 'FV-3301-1', time: '2025-06-15', problems: ['问题D'] },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(groupAlarmRows([])).toEqual([]);
  });
});

describe('table_alarm (B1)', () => {
  it('returns DOCUMENT patch when input has rows', () => {
    const result = table_alarm([
      { tag: 'FV-3301-1', name: '问题A', description: '', time: '2025-05-15' },
      { tag: 'FV-3301-1', name: '问题B', description: '', time: '2025-05-15' },
      { tag: 'FV-3302', name: '问题C', description: '', time: '2025-05-15' },
    ]);
    expect(result.type).toBe(PatchType.DOCUMENT);
    // 1 Table + 1 尾随 Paragraph (Word 兼容, 见"表格 patch 必须以 Paragraph 收尾")
    expect((result.children as unknown[]).length).toBe(2);
  });

  it('produces N table rows = total problems + 1 header (3 problems → 4 rows)', () => {
    const result = table_alarm([
      { tag: 'FV-3301-1', name: '问题A', description: '', time: '2025-05-15' },
      { tag: 'FV-3301-1', name: '问题B', description: '', time: '2025-05-15' },
      { tag: 'FV-3302', name: '问题C', description: '', time: '2025-05-15' },
    ]);
    const table = (result.children as unknown[])[0] as { root: unknown[] };
    const rowCount = table.root.filter((r) => r instanceof TableRow).length;
    expect(rowCount).toBe(4); // 1 header + 3 problems
  });

  it('falls back to PARAGRAPH when input is empty', () => {
    const result = table_alarm([]);
    expect(result.type).toBe(PatchType.PARAGRAPH);
  });
});

// 顾总 07-22 第 6 条: 导出的 docx 一打开就弹"发现无法读取的内容"。
// OOXML 规定表格后必须跟段落, 否则 Word 判定文档损坏。
describe('表格 patch 必须以 Paragraph 收尾 (第 6 条)', () => {
  const lastChildIsParagraph = (patch: { children: unknown[] }) =>
    patch.children[patch.children.length - 1] instanceof Paragraph;

  it('table_alarm', () => {
    const r = table_alarm([
      { tag: 'FV-1', name: '问题A', description: '', time: '2025-05-15' },
    ]);
    expect(lastChildIsParagraph(r as { children: unknown[] })).toBe(true);
  });

  it('table_valves_health_month', () => {
    const r = table_valves_health_month([
      { tag: 'FV-1', data: [{ name: '2025年7月', value: 80 }] },
    ]);
    expect(lastChildIsParagraph(r as { children: unknown[] })).toBe(true);
  });

  it('table_cyclecount_travelaccumulate', () => {
    const cell = (name: string) => ({
      name,
      value: 1,
      style: null as string | null,
    });
    const r = table_cyclecount_travelaccumulate([
      {
        number: 1,
        tag: 'FV-1',
        data: [
          {
            time: '2025/01/01-2025/01/30',
            cycleCount: cell('循环计数'),
            dailyMovementCount: cell('日动作次数'),
            travelAccumulator: cell('行程累计器'),
            amplitudePerAction: cell('次动作幅度'),
          },
        ],
      },
    ]);
    expect(lastChildIsParagraph(r as { children: unknown[] })).toBe(true);
  });
});

describe('table_valves_travel_month', () => {
  it('returns explicit notice text when records is empty (B2)', () => {
    const result = table_valves_travel_month({
      records: [],
      descriptions: [],
    });
    const json = JSON.stringify(result);
    expect(json).toContain('未发现阀门超出有效Cv操作区间');
  });

  // 顾总 07-22 第 8 条: "4 inch" 在窄列里被拆成两行
  it('尺寸列用不换行空格, 避免 "4 inch" 折行', () => {
    const result = table_valves_travel_month({
      records: [
        [
          { key: 'tag', name: '阀门位号', value: 'FV-1', style: null },
          { key: 'size', name: '尺寸', value: '4 inch', style: null },
        ],
      ],
      descriptions: [],
    });
    const json = JSON.stringify(result);
    expect(json).toContain('4\u00a0inch');
    expect(json).not.toContain('4 inch');
  });
});

describe('stripYear (任务 6/9)', () => {
  it.each([
    // 数据源的真实表头格式: 日期区间, 两端年份都要去掉
    ['2025/01/01-2025/03/31', '01/01-03/31'],
    ['2024/10/01-2024/12/31', '10/01-12/31'],
    ['2023年3月', '3月'],
    ['2025-07', '07'],
    ['2025/07', '07'],
    ['7月', '7月'],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(stripYear(input)).toBe(expected);
  });

  it('accepts number / null / undefined', () => {
    expect(stripYear(null)).toBe('');
    expect(stripYear(undefined)).toBe('');
    expect(stripYear(2025)).toBe('2025');
  });

  it('不误伤长得像年份的数值区间', () => {
    expect(stripYear('1440-2000')).toBe('1440-2000');
  });
});

describe('textColorForShading (任务 5)', () => {
  it('returns white on dark backgrounds (紫/红)', () => {
    expect(textColorForShading('#6e298d')).toBe('#ffffff');
    expect(textColorForShading('#ff0000')).toBe('#ffffff');
    expect(textColorForShading('#FF0000')).toBe('#ffffff');
  });

  it('returns black on light or absent backgrounds', () => {
    expect(textColorForShading('#ffff00')).toBe('#000000');
    expect(textColorForShading('#00b050')).toBe('#000000');
    expect(textColorForShading(null)).toBe('#000000');
    expect(textColorForShading(undefined)).toBe('#000000');
  });
});

describe('shadingForCycleCell (任务 6 / 顾总 07-22 第 2·9 条)', () => {
  it('日动作次数 > 1440 标黄', () => {
    expect(shadingForCycleCell('dailyMovementCount', 1441)).toBe('#ffff00');
    expect(shadingForCycleCell('dailyMovementCount', 5000)).toBe('#ffff00');
  });

  it('次动作幅度 > 8 标黄, 含带 % 的字符串值', () => {
    expect(shadingForCycleCell('amplitudePerAction', 9)).toBe('#ffff00');
    // 数据源实际下发的是 "9.92%" 这种字符串, 旧实现 Number() 得 NaN 永远判不出超标
    expect(shadingForCycleCell('amplitudePerAction', '9.92%')).toBe('#ffff00');
    expect(shadingForCycleCell('amplitudePerAction', '8.5%')).toBe('#ffff00');
  });

  it('未超阈值不标色', () => {
    expect(shadingForCycleCell('dailyMovementCount', 1440)).toBe('#ffffff');
    expect(shadingForCycleCell('dailyMovementCount', 100)).toBe('#ffffff');
    expect(shadingForCycleCell('amplitudePerAction', 8)).toBe('#ffffff');
    expect(shadingForCycleCell('amplitudePerAction', '5.16%')).toBe('#ffffff');
  });

  it('只有这两列有阈值, 其余列一律不标', () => {
    expect(shadingForCycleCell('cycleCount', 999999)).toBe('#ffffff');
    expect(shadingForCycleCell('travelAccumulator', 999999)).toBe('#ffffff');
  });

  it('容错 null / 空串 / 非数值', () => {
    expect(shadingForCycleCell('dailyMovementCount', null)).toBe('#ffffff');
    expect(shadingForCycleCell('dailyMovementCount', '')).toBe('#ffffff');
    expect(shadingForCycleCell('dailyMovementCount', 'abc')).toBe('#ffffff');
  });
});

describe('formatCycleValue (顾总 07-22 第 9 条: 保留 1 位小数)', () => {
  it.each([
    ['9.92%', '9.9%'],
    ['5.16%', '5.2%'],
    [3272.456, '3272.5'],
    [11485, '11485'], // 整数不补 .0
    ['48131', '48131'],
  ])('%s → %s', (input, expected) => {
    expect(formatCycleValue(input)).toBe(expected);
  });

  it('空值渲染成空串, 非数值原样输出', () => {
    expect(formatCycleValue(null)).toBe('');
    expect(formatCycleValue(undefined)).toBe('');
    expect(formatCycleValue('')).toBe('');
    expect(formatCycleValue('N/A')).toBe('N/A');
  });
});

describe('table_valves_health_month (任务 2/9)', () => {
  const input = [
    {
      tag: 'FV-1001',
      data: [
        { name: '2025年7月', value: 80 },
        { name: '2025年8月', value: 90 },
      ],
    },
  ];

  it('strips year prefix from header dates (任务 9)', () => {
    const json = JSON.stringify(table_valves_health_month(input));
    expect(json).not.toContain('2025年');
    expect(json).toContain('7月');
    expect(json).toContain('8月');
  });
});
