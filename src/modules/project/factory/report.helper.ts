import * as echarts from 'echarts';
import {
  AlignmentType,
  BorderStyle,
  ImageRun,
  Paragraph,
  PatchType,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  VerticalMergeType,
  WidthType,
} from 'docx';
import { readFileSync } from 'fs';
import dayjs from 'dayjs';
import { find } from 'lodash';

// 去年份: 数据源的表头是日期区间 "2025/01/01-2025/03/31", 也兼容 "2023年3月" / "2025-07"。
// 必须全局替换而非只去开头, 否则区间后半段的年份会残留 (顾总反馈"年份未完全去除")。
// 限定 19xx/20xx 前缀, 免得把 "1440-2000" 这类数值当年份误删。
export const stripYear = (s: string | number | null | undefined): string =>
  String(s ?? '').replace(/(?:19|20)\d{2}[年\-/]/g, '');

// 深色背景 (紫/红) 上文字需改白色以保证可读性
const DARK_SHADING = new Set(['#6e298d', '#ff0000']);
export const textColorForShading = (shading: string | null | undefined): string =>
  DARK_SHADING.has(String(shading || '').toLowerCase()) ? '#ffffff' : '#000000';

// 图片编号 (顾总 2026-08-14 反馈: 导出的报告 Word 一打开就报"发现无法读取的内容")
// docx 的每个 ImageRun 各自 new 一个 id 生成器, 于是文档里每张图的 wp:docPr id 都是 1,
// 而 OOXML 要求它在整个文档内唯一 —— 实测把重复 id 改唯一后同一份文件就能正常打开。
// 起点 1000: 模板自带图片已占用 9/31/71/75/86~89/233, 避开它们。
let docPrSeq = 1000;

// SVG 图表统一走这里, 保证每张图拿到唯一 docPr id
const chartImage = (svg: string, width: number, height: number, name: string) =>
  new ImageRun({
    type: 'svg',
    data: Buffer.from(svg, 'utf-8'),
    transformation: { width, height },
    fallback: { type: 'png', data: readFileSync('public/linux-png.png') },
    altText: { name, id: String(docPrSeq++) },
  });

// 窗边框 (行程历史 / 周期计数页要求)
const BOX_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const TABLE_BORDERS = {
  top: BOX_BORDER,
  bottom: BOX_BORDER,
  left: BOX_BORDER,
  right: BOX_BORDER,
  insideHorizontal: BOX_BORDER,
  insideVertical: BOX_BORDER,
};

// 周期计数超标阈值 (任务 6): 超过则单元格黄底
// ponytail: 阈值写死, 客户群若需差异化再挪配置
// 注意: 本文件下方有自定义 `Record` interface, 遮蔽了 TS 内置泛型, 故用对象字面类型
const CYCLE_OVERLIMIT: { [key: string]: number } = {
  dailyMovementCount: 1440,
  amplitudePerAction: 8,
};
const OVERLIMIT_SHADING = '#ffff00';
const NO_SHADING = '#ffffff';

// 次动作幅度的值是带单位的字符串 ("9.92%"), Number() 会得 NaN 使阈值判断永远失效,
// 必须用 parseFloat 先剥掉后缀。
export const parseCycleValue = (
  value: string | number | null | undefined,
): number =>
  typeof value === 'number' ? value : parseFloat(String(value ?? ''));

// 超标标色 (顾总 2026-07-22 反馈第 2/9 条): 只有日动作次数 > 1440 / 次动作幅度 > 8
// 才标黄, 其余一律无底色 —— 数据源下发的 2/5/8 三档配色 (>2 黄 / >5 红 / >8 紫)
// 不采用, 故不再回退到 originalStyle。
export const shadingForCycleCell = (
  key: string,
  value: string | number | null | undefined,
): string => {
  const threshold = CYCLE_OVERLIMIT[key];
  const numeric = parseCycleValue(value);
  return threshold !== undefined &&
    Number.isFinite(numeric) &&
    numeric > threshold
    ? OVERLIMIT_SHADING
    : NO_SHADING;
};

// 数值保留 1 位小数 (顾总反馈第 9 条)。整数不补 ".0" —— 循环计数这类本就是整数,
// 写成 11485.0 反而难看; 保留原有的 "%" 后缀。
export const formatCycleValue = (
  value: string | number | null | undefined,
): string => {
  const numeric = parseCycleValue(value);
  if (!Number.isFinite(numeric)) return value == null ? '' : String(value);
  const suffix =
    typeof value === 'string' && value.trim().endsWith('%') ? '%' : '';
  return `${Math.round(numeric * 10) / 10}${suffix}`;
};

interface ReportProblemTable {
  tag: string;
  name: string;
  description: string;
  time: string;
}
export interface ValveDetail {
  tag: string;
  items: ValveDetailItem[];
}
export interface ValveDetailItem {
  sort: string;
  tag: string;
  description: string;
  risk: string;
  measures: string;
  name: string;
  plot?: {
    /// 指标名 (行程 / 行程偏差 / 供气压力 / 行程累计器 ...), 用于图表标题
    keywordName?: string;
    /// Y 轴展示单位, 由数据源按关键字给定 ('%' / 'kPa' / '次/日' / '%/次' / '°C' / 'lbf.in' ...)
    unit?: string;
    /// 该关键字的标准线阈值, 由数据源给定 (行程偏差 [2,5] / 行程累计器 [5,8] / 供气压力 [60] ...)
    standardLine?: number[];
    times: string[];
    upperLimit: number;
    lowerLimit: number;
    dataLine: number[];
    predictionLine: {
      linearRegression: number[];
    };
    auxiliaryLine: {
      averageValue: number[];
    };
  };
}

// 标准线 markLine (任务 7/8/13)
// 阈值与单位一律取数据源随 plot 下发的 standardLine / unit, 本仓不再维护一份关键字映射
// —— 之前硬编码的 '反馈信号' / '累积器' 在数据源的关键字表里根本不存在, 单位始终出不来。
// 偏差类指标是有向的 (行程偏差 ±2% / ±5%), 其余 (供气压力 / 循环计数 / 行程累计器) 只画正值。
export const buildStandardMarkLines = (
  standardLine: number[] | undefined,
  keywordName: string | undefined,
  unit: string,
): { name: string; yAxis: number }[] => {
  if (!standardLine?.length) return [];
  const bidirectional = (keywordName || '').includes('偏差');
  return standardLine
    .filter((v) => Number.isFinite(Number(v)))
    .flatMap((v) =>
      bidirectional
        ? [
            { name: `+${v}${unit}`, yAxis: Number(v) },
            { name: `-${v}${unit}`, yAxis: -Number(v) },
          ]
        : [{ name: `${v}${unit}`, yAxis: Number(v) }],
    );
};
interface CycleAccumulation {
  number: number;
  tag: string;
  data: {
    time: string;
    cycleCount: { name: string; value: string | number; style: any };
    dailyMovementCount: { name: string; value: string | number; style: any };
    travelAccumulator: { name: string; value: string | number; style: any };
    amplitudePerAction: { name: string; value: string | number; style: any };
  }[];
}
export interface ValveTravelHistoryRecord {
  records: Record[][];
  descriptions: string[];
}
export interface Record {
  key: string;
  name: string;
  value: string;
  style: any;
}

const renderTableHeaderRow = (data: string[]) => {
  const children = data.map((item) => {
    return new TableCell({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: item, color: '#ffffff' })],
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
      shading: {
        fill: 'b79c2f',
        type: ShadingType.SOLID,
        color: '#43545D',
      },
    });
  });
  return new TableRow({ children });
};

const getTableCellStyle = (value: number, type: number) => {
  if (type === 1) {
    if (value >= 85) {
      return '#00b050';
    } else if (value < 85 && value >= 73) {
      return '#ffff00';
    } else if (value < 73 && value > 0) {
      return '#ff0000';
    } else {
      return '#ffffff';
    }
  } else if (type === 2) {
    if (value >= 80) {
      return '#00b050';
    } else if (value < 80 && value >= 73) {
      return '#ffff00';
    } else if (value < 73 && value > 0) {
      return '#ff0000';
    } else {
      return '#6e298d';
    }
  }
};

export interface AlarmRowGroup {
  tag: string;
  time: string;
  problems: string[];
}

// 把多条 (tag, time, name) 按"同位号同日期"折叠成组，保留首次出现顺序
export function groupAlarmRows(data: ReportProblemTable[]): AlarmRowGroup[] {
  const groups = new Map<string, AlarmRowGroup>();
  for (const r of data) {
    const key = `${r.tag}|${r.time}`;
    if (!groups.has(key)) {
      groups.set(key, { tag: r.tag, time: r.time, problems: [] });
    }
    groups.get(key)!.problems.push(r.name);
  }
  return Array.from(groups.values());
}

// 问题表格 — 同一阀门同一日期的多个问题：序号/位号/日期 cell vMerge，问题描述每个独占一行
export const table_alarm = (data: ReportProblemTable[]) => {
  if (data.length === 0) {
    return {
      type: PatchType.PARAGRAPH,
      children: [new TextRun({ text: ' ' })],
    };
  }
  const groups = groupAlarmRows(data);
  const rows: TableRow[] = [];
  groups.forEach((group, groupIdx) => {
    group.problems.forEach((problem, problemIdx) => {
      const isFirst = problemIdx === 0;
      const vMerge = isFirst
        ? VerticalMergeType.RESTART
        : VerticalMergeType.CONTINUE;
      rows.push(
        new TableRow({
          children: [
            new TableCell({
              verticalMerge: vMerge,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: isFirst ? `${groupIdx + 1}` : '' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              verticalMerge: vMerge,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isFirst ? group.tag : '' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 4000, type: WidthType.DXA },
              children: [new Paragraph({ text: problem })],
            }),
            new TableCell({
              verticalMerge: vMerge,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isFirst ? group.time : '' })],
                }),
              ],
            }),
          ],
        }),
      );
    });
  });
  return {
    type: PatchType.DOCUMENT,
    children: [
      new Table({
        rows: [
          renderTableHeaderRow(['序号', '阀门位号', '问题描述', '报告日期']),
          ...rows,
        ],
      }),
      // OOXML 要求表格后必须跟一个段落, 否则 Word 打开时报"发现无法读取的内容"
      // (顾总 2026-07-22 反馈第 6 条)。两个表格直接相邻也会被 Word 合并成一个。
      new Paragraph({}),
    ],
  };
};
// 健康饼图
export const chart_valves_health_overview = (
  data: { name: string; value: number }[],
) => {
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 250,
    height: 300,
  });
  chart.setOption({
    color: ['#ff0000', '#ffff00', '#00b050', '#00b050', '#00b050'],
    legend: { top: '5%', left: 'center' },
    series: [
      {
        name: 'Access From',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          position: 'inner',
          fontSize: 14,
          color: '#000000',
          formatter: '{c}',
        },
        labelLine: { show: false },
        data,
      },
    ],
  });
  return {
    type: PatchType.PARAGRAPH,
    children: [
      chartImage(chart.renderToSVGString(), 250, 300, '阀门健康分布图'),
    ],
  };
};
// 告警饼图
export const chart_values_alarm_overivew = (
  data: { name: string; value: number }[],
) => {
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 250,
    height: 300,
  });
  chart.setOption({
    color: ['#00b050', '#ff0000'],
    legend: { top: '5%', left: 'center' },
    series: [
      {
        name: 'Access From',
        type: 'pie',
        radius: ['40%', '70%'],
        label: {
          position: 'inner',
          fontSize: 14,
          color: '#000000',
          formatter: '{b}: {c}',
        },
        labelLine: { show: false },
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        data: data.map((item) => {
          return {
            name: item.name,
            value: item.value,
            itemStyle: {
              color: item.name === '正常' ? '#00b050' : '#ff0000',
            },
          };
        }),
      },
    ],
  });
  return {
    type: PatchType.PARAGRAPH,
    children: [
      chartImage(chart.renderToSVGString(), 250, 300, '阀门告警占比图'),
    ],
  };
};
// 状况状态柱状图
export const chart_valves_quarter = (
  data: { name: string; alert: number; normal: number }[],
) => {
  const names = data.map((item) => item.name);
  const alerts = data.map((item) => item.alert);
  const normals = data.map((item) => item.normal);
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 500,
    height: 300,
  });
  chart.setOption({
    color: ['#00b050', '#ff0000'],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: {},
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: [{ type: 'category', data: names }],
    yAxis: [{ type: 'value' }],
    series: [
      {
        name: '正常',
        type: 'bar',
        stack: 'Ad',
        label: {
          show: true,
          position: 'inside',
          color: '#000000',
          formatter: '{c}',
        },
        itemStyle: { color: '#00b050' },
        data: normals,
      },
      {
        name: '告警',
        type: 'bar',
        stack: 'Ad',
        label: {
          show: true,
          position: 'inside',
          color: '#000000',
          formatter: '{c}',
        },
        itemStyle: { color: '#ff0000' },
        data: alerts,
      },
    ],
  });
  return {
    type: PatchType.PARAGRAPH,
    children: [
      new TextRun({ text: ` `, break: 1 }),
      chartImage(chart.renderToSVGString(), 500, 300, '阀门季度状态图'),
    ],
  };
};
// 阀门健康趋势
export const table_valves_health_month = (
  data: { tag: string; data: { name: string; value: number }[] }[],
) => {
  if (data.length === 0) {
    return {
      type: PatchType.PARAGRAPH,
      children: [new TextRun({ text: ' ' })],
    };
  }
  return {
    type: PatchType.DOCUMENT,
    children: [
      new Table({
        width: {
          size: 9000,
          type: WidthType.DXA,
        },
        rows: [
          renderTableHeaderRow([
            '序号',
            '阀门位号',
            ...data[0].data.map((i) => stripYear(i.name)),
          ]),
          ...data.map((item, index) => {
            return new TableRow({
              children: [
                new TableCell({
                  verticalAlign: VerticalAlign.CENTER,
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: `${index + 1}` })],
                    }),
                  ],
                }),
                new TableCell({
                  verticalAlign: VerticalAlign.CENTER,
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: item.tag })],
                    }),
                  ],
                }),
                ...item.data.map((i) => {
                  return new TableCell({
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: `${i.value}`,
                            color: '#000000',
                          }),
                        ],
                      }),
                    ],
                    shading: {
                      fill: 'b79c2f',
                      type: ShadingType.SOLID,
                      color: getTableCellStyle(i.value, 1),
                    },
                  });
                }),
              ],
            });
          }),
        ],
      }),
      // 见 table_alarm 中的说明: 表格后必须跟段落, 否则 Word 报文档损坏
      new Paragraph({}),
    ],
  };
};
// 阀门细节图 ECharts option 构造（纯函数，便于单元测试）
// series 顺序 = 绘制顺序，后绘制在上层：标准线 → 平均值 → 预测线 → 数据线（数据线最上）
// 颜色与前端 (client) ChartModal/workTable 默认 ECharts 调色板对齐：
//   数据线=蓝 / 预测线=绿 / 平均值=黄 / 标准线=红。
// 前端无 itemStyle.color，PDF 这边因 series 顺序重排（B8），必须按 name 显式绑色。
const CHART_COLORS = {
  dataLine: '#5470c6', // ECharts 默认 [0] 蓝
  predictionLine: '#91cc75', // ECharts 默认 [1] 绿
  averageLine: '#fac858', // ECharts 默认 [2] 黄
  standardLine: '#ee6666', // ECharts 默认 [3] 红
} as const;

export function buildAlarmChartOption(
  plot: NonNullable<ValveDetailItem['plot']>,
) {
  const lowerLimit = Number(plot.lowerLimit || 0);
  const upperLimit = Number(plot.upperLimit || 0);
  const unit = plot.unit || '';
  const extraMarks = buildStandardMarkLines(
    plot.standardLine,
    plot.keywordName,
    unit,
  );
  const extraYs = extraMarks.map((m) => m.yAxis);
  const rawMax = Math.max(...plot.dataLine, upperLimit, ...extraYs);
  const rawMin = Math.min(...plot.dataLine, lowerLimit, ...extraYs);
  const labelTop = { show: true, position: 'top' as const, color: '#000000' };
  const title = plot.keywordName
    ? unit
      ? `${plot.keywordName} (${unit})`
      : plot.keywordName
    : '';
  return {
    // 任务 7: 图表标题 (指标名 + 单位)
    ...(title ? { title: { text: title, left: 'center' } } : {}),
    legend: { data: ['数据线', '预测线', '平均值', '标准线'], bottom: 0 },
    tooltip: { trigger: 'axis' as const },
    xAxis: { type: 'category' as const, data: plot.times },
    // 任务 8/13: Y 轴左侧显示单位名称
    yAxis: {
      type: 'value' as const,
      name: plot.unit || undefined,
      nameLocation: 'end' as const,
      max: Math.ceil(rawMax),
      min: Math.floor(rawMin),
    },
    label: { fontSize: 14 },
    series: [
      {
        type: 'line' as const,
        name: '标准线',
        itemStyle: { color: CHART_COLORS.standardLine },
        lineStyle: { color: CHART_COLORS.standardLine },
        label: labelTop,
        markLine: {
          lineStyle: { color: CHART_COLORS.standardLine },
          // 任务 7/8: 上下限 + 数据源下发的该关键字标准线
          data: [
            { name: '下限值', yAxis: lowerLimit },
            { name: '上限值', yAxis: upperLimit },
            ...extraMarks,
          ],
        },
      },
      {
        type: 'line' as const,
        name: '平均值',
        itemStyle: { color: CHART_COLORS.averageLine },
        lineStyle: { color: CHART_COLORS.averageLine },
        data: plot.auxiliaryLine.averageValue,
        label: labelTop,
      },
      {
        type: 'line' as const,
        name: '预测线',
        itemStyle: { color: CHART_COLORS.predictionLine },
        lineStyle: { color: CHART_COLORS.predictionLine },
        data: plot.predictionLine.linearRegression,
        label: labelTop,
      },
      {
        type: 'line' as const,
        name: '数据线',
        itemStyle: { color: CHART_COLORS.dataLine },
        lineStyle: { color: CHART_COLORS.dataLine },
        data: plot.dataLine,
        label: labelTop,
      },
    ],
  };
}

// 数据源对"没有曲线"的问题下发的是空数组 plot: [], 有曲线时才是对象。
// times / dataLine 是画图的原料, auxiliaryLine / predictionLine 会被 buildAlarmChartOption
// 直接解引用 —— 少任何一个都只出文字, 不能让整份报告 500。
export const hasPlotData = (
  plot: ValveDetailItem['plot'],
): plot is NonNullable<ValveDetailItem['plot']> =>
  !!plot &&
  !Array.isArray(plot) &&
  !!plot.times?.length &&
  !!plot.dataLine?.length &&
  !!plot.auxiliaryLine &&
  !!plot.predictionLine;

// 问题详情列表
export const detail_valves_alarm = (data: ValveDetail[]) => {
  const renderArray = data.map((list, index) => {
    const r = list.items.map((item) => {
      const lines = [
        new TextRun({
          text: `${item.sort}：`,
          bold: true,
          break: 1,
        }),
        new TextRun({ text: `阀门位号：${item.tag}`, break: 1 }),
        new TextRun({
          text: `问题描述：${item.description}`,
          break: 1,
        }),
        new TextRun({ text: `潜在风险：${item.risk}`, break: 1 }),
        new TextRun({ text: `建议措施：${item.measures}`, break: 1 }),
        new TextRun({ text: ` `, break: 1 }),
      ];
      // 没有曲线的问题(阶跃响应 / PD 一键测试等)只出文字, 不能整条丢掉
      // —— 顾总 08-14 那份报告 11 条问题里 8 条就是这么消失的
      if (!hasPlotData(item.plot)) return lines;

      const chart = echarts.init(null, null, {
        renderer: 'svg',
        ssr: true,
        width: 400,
        height: 300,
      });
      chart.setOption(buildAlarmChartOption(item.plot));
      return [
        ...lines,
        // Why: 尺寸与 chart 渲染一致，避免 500x300 拉伸 400x300 数据图变形
        chartImage(
          chart.renderToSVGString(),
          400,
          300,
          `${item.tag} ${item.plot.keywordName || ''}`.trim(),
        ),
      ];
    });
    const flattenedR = r.flat();
    return [
      new TextRun({
        text: `阀门${index + 1}： ${list.tag || ''}`,
        bold: true,
        size: 28,
        break: 1,
      }),
      ...flattenedR,
      new TextRun({ text: ` `, break: 1 }),
    ];
  });
  const flattenedRenderArray = renderArray.flat();
  return {
    type: PatchType.DOCUMENT,
    children: [
      new Paragraph({
        children: [
          ...flattenedRenderArray,
          new TextRun({ text: ` `, break: 1 }),
        ],
      }),
    ],
  };
};
// 动态控制 性能趋势
export const table_dynamic_control_month = (
  data: {
    tag: string;
    data: { time: string; score: number; description: string }[];
  }[],
) => {
  if (data.length === 0) {
    return {
      type: PatchType.PARAGRAPH,
      children: [new TextRun({ text: ' ' })],
    };
  }
  const times = data[0].data.map((i) => dayjs(i.time).format('YYYY-MM-DD'));
  return {
    type: PatchType.DOCUMENT,
    children: [
      new Table({
        rows: [
          renderTableHeaderRow(['序号', '阀门位号', ...times]),
          ...data.map((item, index) => {
            return new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: `${index + 1}` })],
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: item.tag })],
                    }),
                  ],
                }),
                ...item.data.map((i) => {
                  return new TableCell({
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: `${i.description}`,
                            color: '#ffffff',
                          }),
                        ],
                      }),
                    ],
                    shading: {
                      fill: 'b79c2f',
                      type: ShadingType.SOLID,
                      color: getTableCellStyle(i.score, 2),
                    },
                  });
                }),
              ],
            });
          }),
        ],
      }),
    ],
  };
};
// 季度阀门行程历史记录
export const table_valves_travel_month = (data: ValveTravelHistoryRecord) => {
  if (data.records.length === 0) {
    return {
      type: PatchType.PARAGRAPH,
      children: [
        new TextRun({
          text: '本次报告，未发现阀门超出有效Cv操作区间问题。',
        }),
      ],
    };
  }
  const tableHeaderRow = data.records[0].map((i) => i.name);
  const renderArray = data.descriptions.map((item) => {
    return new TextRun({ text: item, break: 1 });
  });
  return {
    type: PatchType.DOCUMENT,
    children: [
      new Table({
        borders: TABLE_BORDERS,
        rows: [
          renderTableHeaderRow(tableHeaderRow),
          ...data.records.map((item) => {
            const children: any[] = [];
            for (let i = 0; i < item.length; i++) {
              const cell = find(item, (o) => o.name === tableHeaderRow[i]);
              if (!cell) {
                continue;
              }
              const getCellValue = (cell: Record) => {
                if (
                  ['globeValve', 'rotaryValve', 'butteValve'].includes(cell.key)
                ) {
                  return cell.value ? '✓' : '';
                }
                // 尺寸值形如 "4 inch", 窄列里会在空格处断成两行 (顾总反馈第 8 条),
                // 用不换行空格钉住, 让 Word 去撑列宽而不是折行
                if (cell.key === 'size') {
                  return cell.value ? String(cell.value).replace(/ /g, '\u00a0') : '';
                }
                return cell.value ? cell.value + '' : '';
              };
              children.push(
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: getCellValue(cell),
                          color: textColorForShading(cell.style),
                        }),
                      ],
                    }),
                  ],
                  shading: {
                    fill: 'b79c2f',
                    type: ShadingType.SOLID,
                    color: cell.style || '#ffffff',
                  },
                }),
              );
            }
            return new TableRow({ children });
          }),
        ],
      }),

      new Paragraph({
        children: renderArray,
      }),
    ],
  };
};
// 周期计数/行程百分比累积
export const table_cyclecount_travelaccumulate = (
  data: CycleAccumulation[],
) => {
  if (data.length === 0) {
    return {
      type: PatchType.PARAGRAPH,
      children: [new TextRun({ text: ' ' })],
    };
  }
  const times = data[0].data.map((i) => i.time);
  const headerBase = ['序号', '阀门位号'];
  const header = ['循环计数', '日动作次数', '行程累计器', '次动作幅度'];
  // 根据时间生成表头
  const row1 = new TableRow({
    children: [
      ...headerBase.map((item) => {
        return new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: item || '', color: '#000000' })],
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          shading: {
            fill: 'b79c2f',
            type: ShadingType.SOLID,
            color: '#43545D',
          },
        });
      }),
      ...header.map((item) => {
        return new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: item || '', color: '#ffffff' })],
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          columnSpan: 3,
          shading: {
            fill: 'b79c2f',
            type: ShadingType.SOLID,
            color: '#43545D',
          },
        });
      }),
    ],
  });
  const timesRow = times.map((item) => {
    return new TableCell({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: stripYear(item), color: '#ffffff' })],
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
      columnSpan: 1,
      shading: {
        fill: 'b79c2f',
        type: ShadingType.SOLID,
        color: '#43545D',
      },
    });
  });

  const timesRow2: any[] = [];
  header.map(() => {
    timesRow2.push(...timesRow);
  });

  // https://github.com/dolanmiu/docx/issues/695
  return {
    type: PatchType.DOCUMENT,
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
        rows: [
          row1,
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: '', color: '#ffffff' })],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: '', color: '#ffffff' })],
                  }),
                ],
              }),
              ...timesRow2,
            ],
          }),
          ...data.map((item) => {
            const children: any[] = [
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: `${item.number}` })],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: item.tag || '' })],
                  }),
                ],
              }),
            ];
            // 获取阀门月份数组
            const valveMonth = item.data.map((i) => i.time);
            const valveHeader = [
              'cycleCount',
              'dailyMovementCount',
              'travelAccumulator',
              'amplitudePerAction',
            ];
            // 查找 valveHeader 中 time 对应的数据
            valveHeader.forEach(
              (i: Exclude<keyof CycleAccumulation['data'][0], 'time'>) => {
                // 根据顺序获取对应的月份数据
                valveMonth.forEach((month) => {
                  const cell = find(item.data, (o) => o.time === month);
                  if (!cell) {
                    return;
                  }
                  children.push(
                    new TableCell({
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: formatCycleValue(cell[i].value),
                              color: '#000000',
                            }),
                          ],
                        }),
                      ],
                      shading: {
                        fill: 'b79c2f',
                        type: ShadingType.SOLID,
                        color: shadingForCycleCell(i, cell[i].value),
                      },
                    }),
                  );
                });
              },
            );
            return new TableRow({ children });
          }),
        ],
      }),
      // 见 table_alarm 中的说明: 表格后必须跟段落, 否则 Word 报文档损坏
      new Paragraph({}),
    ],
  };
};
