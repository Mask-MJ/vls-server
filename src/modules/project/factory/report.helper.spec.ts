import { PatchType, TableRow } from 'docx';
import {
  buildAlarmChartOption,
  groupAlarmRows,
  stripYear,
  table_alarm,
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
    // 1 Table 实例（与 children 数组里实例数一致）
    expect((result.children as unknown[]).length).toBe(1);
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

describe('table_valves_travel_month', () => {
  it('returns explicit notice text when records is empty (B2)', () => {
    const result = table_valves_travel_month({
      records: [],
      descriptions: [],
    });
    const json = JSON.stringify(result);
    expect(json).toContain('未发现阀门超出有效Cv操作区间');
  });
});

describe('stripYear (任务 6/9)', () => {
  it.each([
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
